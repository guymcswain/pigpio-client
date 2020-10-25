/*
 Construct a pigpio client object that connects with a remote pigpio
 server (pigpiod) and allows manipulation of its gpio pins.
 */
const assert = require('assert')
const EventEmitter = require('events')
class MyEmitter extends EventEmitter {}
const util = require('util')
const SIF = require('./SIF.js')
const API = SIF.APInames
const ERR = SIF.PigpioErrors

// pigpio supported commands:
const { BR1, BR2, TICK, HWVER, PIGPV, PUD, MODES, MODEG, READ, WRITE, PWM, WVCLR,
WVCRE, WVBSY, WVAG, WVCHA, NOIB, NB, NP, NC, SLRO, SLR, SLRC, SLRI, WVTXM, WVTAT,
WVHLT, WVDEL, WVAS, HP, HC, GDC, PFS, FG, SERVO, GPW, SPIO, SPIC, SPIW, FO, FC, FR,
FS, I2CO, I2CC, I2CRD, I2CWD, EVM } = SIF.Commands

// These command types can not fail, ie, return p3 as positive integer
const canNeverFailCmdSet = new Set([HWVER, PIGPV, BR1, BR2, TICK])

// These command types have extended command data lengths
const extReqCmdSet = new Set([WVCHA, WVAG, SLRO, WVAS, HP, SPIO, SPIW, FO, FS, I2CO,
I2CWD])

// These command types have extended response data lengths
const extResCmdSet = new Set([SLR, FR, I2CRD])

/* pigpio constants */
const {PUD_OFF, PUD_DOWN, PUD_UP, PI_WAVE_MODE_ONE_SHOT, PI_WAVE_MODE_REPEAT,
PI_WAVE_MODE_ONE_SHOT_SYNC, PI_WAVE_MODE_REPEAT_SYNC, PI_FILE_READ, PI_FILE_WRITE,
PI_FILE_RW, PI_FROM_START, PI_FROM_CURRENT, PI_FROM_END} = SIF.Constants

exports.Constants = SIF.Constants;

var info = {
  host: 'localhost',
  port: 8888,
  pipelining: false,
  commandSocket: undefined,       // connection status undefined until 1st connect
  notificationSocket: undefined,  // connection status undefined until 1st connect
  pigpioVersion: '',
  hwVersion: '',
  hardware_type: 2,  // 26 pin plus 8 pin connectors (ie rpi model B)
  userGpioMask: 0xfbc6cf9c,
  timeout: 0,  // Default is back compatible with v1.0.3. Change to 5 in next ver.
  version: '1.5.1',
}
var log = function(...args) {
  if (/pigpio/i.test(process.env.DEBUG) || process.env.DEBUG === '*') {
    console.log('pigpio-client ', ...args)
  }
}
/*****************************************************************************/
exports.pigpio = function (pi) {
  var requestQueue = []
  var callbackQueue = []
  const net = require('net')
  // update info
  if (typeof pi === 'undefined') pi = {}
  info.host = pi.host || info.host
  info.port = pi.port || info.port
  info.pipelining = pi.pipelining || info.pipelining
  info.timeout = (pi.hasOwnProperty('timeout'))? pi.timeout : info.timeout
  // constructor object inherits from EventEmitter
  var that = new MyEmitter() // can't use prototypal inheritance

// Command socket
  var commandSocket = initSocket('commandSocket')
  function initSocket (name) {
    let socket = new net.Socket()
    socket.name = name
    socket.on('connect', connectHandler(socket))
    socket.reconnectHandler = returnErrorHandler(socket)
    socket.disconnectHandler = disconnector(socket)
    socket.closeHandler = returnCloseHandler(socket)
    socket.addListener('error', socket.reconnectHandler)
    socket.addListener('close', socket.closeHandler)

    return socket
  }
  connect(commandSocket)

  function startRetryTimer(sock) {
    if (info.timeout) {
      sock.retryTimer = setTimeout( () => {
        if (sock.reconnectTimer) {
          clearTimeout(sock.reconnectTimer)
          sock.reconnectTimer = null
        }

        log(`${sock.name} retry timeout`)
        // hack: we don't want two error events
        if (sock.name === 'commandSocket')
          that.emit('error', new MyError({
            api: 'connect',
            message: 'Could not connect, retry timeout expired.'
          }))
      }, info.timeout * 60 * 1000)
      sock.retryTimer.unref()
    }
  }

  function connect(sock) {
    startRetryTimer(sock)
    sock.connect(info.port, info.host)
  }

  function stopRetryTimer(sock) {
    if (sock.retryTimer) {
      clearTimeout(sock.retryTimer)
      sock.retryTimer = null
    }
  }

  function connectHandler(sock) {
    var handler = function() {
      stopRetryTimer(sock)

      if (typeof info[sock.name] === 'undefined') {
        log(`${sock.name} connected`)
      } else log(`${sock.name} reconnected`)

      // run the unique portion of connect handlers
      if (sock.name === 'commandSocket') {
        commandSocketConnectHandler( () => {
          info[sock.name] = true // indicates socket is connected
          if (info.notificationSocket) {
            log('pigpio-client ready')
            that.emit('connected', info)
          }
        })
      }
      if (sock.name === 'notificationSocket') {
        notificationSocketConnectHandler( () => {
          info[sock.name] = true // indicates socket is connected
          if (info.commandSocket) {
            that.emit('connected', info)
            log('pigpio-client ready')
          }
        })
      }
    }
    return handler
  }

  function commandSocketConnectHandler(done) {
        // (re)initialize stuff
        requestQueue = []   // flush
        callbackQueue = []  // flush
        // get pigpio version info then signal 'connected'
        request(PIGPV, 0, 0, 0, (err, res) => {
          info.pigpioVersion = res

          request(HWVER, 0, 0, 0, (err, version) => {

            info.hwVersion = version
            if ((version >= 2) && (version <= 3)) {
              info.hardware_type = 1
              info.userGpioMask = 0x3e6cf93
            }
            if ((version > 4) && (version < 15)) {
              info.hardware_type = 2
              info.userGpioMask = 0xfbc6cf9c  // default
            }
            if (version > 15) {
              info.hardware_type = 3
              info.userGpioMask = 0xffffffc
            }
            done()
          })
        })
  }

  function disconnector(sock) {
    var handler = function(reason) {
      sock.destroy()
      if (sock.reconnectTimer) {
        clearTimeout(sock.reconnectTimer)
        sock.reconnectTimer = null
      }
      if (sock.retryTimer) {
        clearTimeout(sock.retryTimer)
        sock.retryTimer = null
      }
      if (sock.name === 'notificationSocket') {
        sock.setTimeout(0)

      }
      log(`${sock.name} destroyed due to ${reason}`)
      info[sock.name] = false // mark socket disconnected
      // after all sockets are destroyed, alert application
      if ( (!info.commandSocket && !info.notificationSocket) ) {
        that.emit('disconnected', reason)
        log('sent disconnect event to application')
      }
    }
    return handler
  }

  commandSocket.on('end', function () {
      log('pigpio command socket end received')
  })

  function returnErrorHandler(sock) {
    var handler = function (e) {
      log(`${sock.name} error code: ${e.code}, message: ${e.message}`)

      if (sock.pending /*&& sock.connecting)*/)
      {
        if (sock.retryTimer) {
          sock.reconnectTimer = setTimeout( () => {
            sock.connect(info.port, info.host)
          }, 5000)
          sock.reconnectTimer.unref()
          log(`retry connection on ${sock.name} in 5 sec ...`)

          // For each error code, inform user of retry timeout activity.
          if ( !sock.retryEcode && sock.name === 'commandSocket') {
            sock.retryEcode = e.code
            console.log(`${e.code}, retrying ${info.host}:${info.port} ...`)
        }
      }

        // Inform user/app that connection could not be established.
        else if (sock.name === 'commandSocket') {
          console.log(`Unable to connect to pigpiod.  No retry timeout option `
            + 'was specified.  Verify that daemon is running from '
            + `${info.host}:${info.port}.`
          )

          that.emit('error', new MyError(e.message))
        }
      }

      else if ( !sock.pending) {
        return sock.disconnectHandler(`${sock.name}: ${e.code}, ${e.message}`)
      }

      else {
        // On any other socket condition, throw
      that.emit('error', new MyError('Unhandled socket error, '+e.message))
      }
    }
    return handler
  }

  function returnCloseHandler(sock) {
    var handler = function (had_error) {
      if (had_error) {
        // Error handler has already called disconnectHandler as needed.
        log(`${sock.name} closed on error`)
      }

      // If closed without error, must call disconnectHandler from here.
      else {
        log(`${sock.name} closed`)
        if (info[sock.name]) sock.disconnectHandler('closed unexpectedly')
      }
    }
    return handler
  }

  var resBuf = Buffer.allocUnsafe(0)  // see responseHandler()

  commandSocket.on('data', commandSocketDataHandler)

  function commandSocketDataHandler (chunk) {
    resBuf = Buffer.concat([resBuf, chunk])
    if (resBuf.length >= 16) responseHandler()
  }

  function responseHandler () {
      /*  Extract response parameter (along with extended params) from response buffer
      (resBuf), return response as array argument to queued callback function in
      'callbackQueue.'  p3 contains either error code (if negative) OR response OR
      length of extended parameters.  Decoding cmd tells us if p3 is extended type of
      command. Partial response is saved to be used in subsequent 'data' callbacks.
      If response buffer contains more than a single response, the remainder will
      either be saved or called recursively.
      */
      const resArrBuf = new Uint8Array(resBuf).buffer  // creates an Array Buffer copy
      const cmd = new Uint32Array(resArrBuf, 0, 1)  // view of first 4 32bit params
      var extLen  // length of extended response
      var res = []
      var err = null
      if (canNeverFailCmdSet.has(cmd[0])) {
        // case p3 is uint32, always 16 length
        var p3 = new Uint32Array(resArrBuf, 12, 1)
        extLen = 0
        // res[0] = p3[0];
      } else {
        var p3 = new Int32Array(resArrBuf, 12, 1)
        if (p3[0] > 0) {
          // is this extended response?
          if (extResCmdSet.has(cmd[0])) {
            extLen = p3[0] // p3 is length of extension
            // is response buffer incomplete?
            if (resArrBuf.byteLength < (extLen + 16)) { return }  // wait for more data
            else {
              let uint8Arr = new Uint8Array(resArrBuf, 16, extLen)
              for (let i = 0; i < extLen; i++) { res[i] = uint8Arr[i] }
            }
          } else {
            // res[0] = p3[0]; // p3 is normal response param
            extLen = 0
          }
        } else { // p3 is less than (error) or equal (normal) to zero
          extLen = 0
          if (p3[0] < 0) {
            err = p3[0] // param[3] contains error code (negative)
          }
        }
      }
      // prepare the error object -> FIXME, create an error subclass?
      let error = null
      if (err) {
        error = new MyError({
          name: "pigpioError",
          code: ERR[err].code,
          message: ERR[err].message,
          api: API[cmd[0]]
        })
        //error.code = ERR[err].code
        //error.message = `${ERR[err].message}, api: ${API[cmd[0]]}`
      }

      if (process.env.PIGPIO) {
        let b = resBuf.slice(0, 16).toJSON().data
        console.log('response= ', ...b)
        if (extLen > 0) {
          let bx = resBuf.slice(16).toJSON().data
          console.log('extended params= ', ...bx)
        }
      }
      resBuf = resBuf.slice(extLen + 16) // leave remainder for later processing
      // process the response callback
      var callback = callbackQueue.shift() // FIXME: test for queue underflow
      if (typeof callback === 'function') callback(error, p3[0], ...res)
      else {
        if (error) {
          that.emit('error', error)
        }
      }
      // does response buffer contain another response (potentially)?
      if (resBuf.length >= 16) responseHandler() // recurse
      // check requestQueue for more requests to send
      if (requestQueue.length > 0 && (info.pipelining || callbackQueue.length === 0)) {
        var req = requestQueue.shift()
        commandSocket.write(req.buffer)
        callbackQueue.push(req.callback)
        if (process.env.PIGPIO) {
          let b = req.buffer.slice(0, 16).toJSON().data// w/o ext params!
          console.log('deferred request= ', ...b)
          if (req.buffer.length > 16) {
            let bx = req.buffer.slice(16).toJSON().data // w/ext
            console.log('extended params= ', ...bx)
          }
        }
      }
    } // responseHandler


  // helper functions
  var request = (cmd, p1, p2, p3, cb, extArrBuf) => {
    var bufSize = 16
    var buf = Buffer.from(Uint32Array.from([cmd, p1, p2, p3]).buffer) // basic
    if (extReqCmdSet.has(cmd)) {
      // following is not true for waveAddSerial!
      // assert.equal(extArrBuf.byteLength, p3, "incorrect p3 or array length");
      bufSize = 16 + extArrBuf.byteLength
      let extBuf = Buffer.from(extArrBuf) // extension
      buf = Buffer.concat([buf, extBuf])
    }

    var promise;
    if (typeof cb !== 'function') {
      promise = new Promise((resolve, reject) => {
        cb = (error, ...args) => {
          if (error) {
            reject(error)
          } else {
            resolve(args.length > 1 ? args : args[0]);
          }
        }
      })
    }

    // Queue request if request queue is not empty OR callback queue is not empty and pipelining disabled
    if (requestQueue.length > 0 || (callbackQueue.length > 0 && !info.pipelining)) {
      requestQueue.push({buffer: buf, callback: cb})
    } else {
      commandSocket.write(buf)
      callbackQueue.push(cb)
      if (process.env.PIGPIO) {
        let b = buf.slice(0, 16).toJSON().data // exclude extended params!
        console.log('request= ', ...b)
        if (bufSize > 16) {
          let bx = buf.slice(16).toJSON().data // extended params
          console.log('extended params= ', ...bx)
        }
      }
    }

    return promise
  } // request()


// Notifications socket = ToDo: check for notification errors response (res[3])
  var handle
  var chunklet = Buffer.allocUnsafe(0) // notify chunk fragments
  var oldLevels

  var notificationSocket = initSocket('notificationSocket')
  connect(notificationSocket)

  function notificationSocketConnectHandler(done) {
    // connect handler here
    let noib = Buffer.from(new Uint32Array([NOIB, 0, 0, 0]).buffer)
    notificationSocket.write(noib, () => {
      // listener once to get handle from NOIB request
      notificationSocket.once('data', (resBuf) => {
        let cmd = resBuf.readUIntLE(0, 4)
        let p1 = resBuf.readUIntLE(4, 4)
        let p2 = resBuf.readUIntLE(8, 4)
        let res = resBuf.readIntLE(12, 4)

        if (cmd!==NOIB || p1!==0 || p2!==0) {
          res = 255 // set to invalid handle value
          that.emit('error', new MyError({
            message: 'Unexpected response to NOIB command on notification socket',
            api: 'construct pigpio'
          }))
        }
        else if (res < 0) {
          that.emit('error',  new MyError({
            name: "pigpioError",
            code: ERR[res].code,
            message: ERR[res].message,
            api: API[cmd]
          }))
        }
        handle= res
        log('opened notification socket with handle= ' + handle)

        // Enable BSC peripheral event monitoring (pigpio built-in event)
        let arrayBuffer = new Uint8Array(4)
        let bscEventBits = new Uint32Array(arrayBuffer, 0, 1)
        bscEventBits[0] = 0x80000000
        that.request(EVM, handle, bscEventBits[0], 0, (err) => {
          if (err) {
            log('bsc event monitoring FAILED: ' + err)
          }
          else log('bsc event monitoring active')
        })

        // Pigpio keep-alive:  Wait options.timeout minutes before disconnecting.
        notificationSocket.setTimeout(info.timeout * 60 * 1000, () => {
          log('Pigpio keep-alive packet not received before timeout expired')
          // generate an (custom) error exception on the socket(s)
          notificationSocket.disconnectHandler('pigpio keep-alive timeout')
          commandSocket.disconnectHandler('pigpio keep-alive timeout')
        })

        // listener that monitors all gpio bits
        notificationSocket.on('data', notificationSocketDataHandler)
        done() // connect handler completed callback
      })
    })
  }

  function notificationSocketDataHandler (chunk) {
          if (process.env.PIGPIO) {
            console.log(`notification received: chunk size = ${chunk.length}`)
          }
          var buf = Buffer.concat([chunklet, chunk])
          let remainder = buf.length % 12
          chunklet = buf.slice(buf.length-remainder)

          // skip if buf is a fragment
          if (buf.length / 12 > 0) {
            // process notifications, issue callbacks to registerd notifier if bits have changed
            for (let i = 0; i < buf.length - remainder; i += 12) {
              let seqno = buf.readUInt16LE(i + 0),
                flags = buf.readUInt16LE(i + 2),
                tick = buf.readUInt32LE(i + 4),
                levels = buf.readUInt32LE(i + 8)

        if (flags & 0x80 && (flags & 0x1F) === 31) {
          that.emit('EVENT_BSC')
        }

              let changes = oldLevels ^ levels
              oldLevels = levels
              for (let nob of notifiers.keys()) {
                if (nob.bits & changes) {
                  nob.func(levels, tick)
                }
              }
            }
          }
  }

  notificationSocket.on('end', function () {
      log('pigpio notification socket end received')
  })

  /** * Public Methods ***/

  that.request = request

  that.connect = function() {
    if (commandSocket.destroy) {
      log('Remove all listeners and destroy command socket.')
      commandSocket.removeAllListeners()
      commandSocket.destroy()
    }
    commandSocket = initSocket('commandSocket')
    commandSocket.addListener('data', commandSocketDataHandler)
    connect(commandSocket)

    if (notificationSocket.destroy) {
      log('Remove all listeners and destroy notification socket.')
      notificationSocket.removeAllListeners()
      notificationSocket.destroy()
    }
    notificationSocket = initSocket('notificationSocket')
    notificationSocket.addListener('data', notificationSocketDataHandler)
    connect(notificationSocket)

  }

// Notifications
//  Must **always** use 'request()' to configure/control pigpio.  Ie, don't to this:
//  commandSocket.write(...);  // will screw up request callbackQueue!!!
  const MAX_NOTIFICATIONS = 32
  var nID = 0
  var notifiers = new Set()
  var monitorBits = 0
  that.startNotifications = function (bits, cb) {
    if (notifiers.size === MAX_NOTIFICATIONS) {
      let error = new MyError('Notification limit reached, cannot add this notifier')
      error.code = 'PI_CLIENT_NOTIFICATION_LIMIT'
      that.emit('error', error)
      return null
    }

    // Registers callbacks for this gpio
    var nob = {
      id: nID++,
      func: cb,
      bits: +bits
    }
    notifiers.add(nob)


    // If not currently monitoring, update the current levels (oldLevels)
    if (monitorBits === 0) {
      request(BR1, 0, 0, 0, (err, levels) => {
        if (err) {
          //that.emit('error', new Error('pigpio: ', ERR[err].message))
          let error = new MyError('internal pigpio error: ' +ERR[err].message)
          error.code = ERR[err].code
          that.emit('error', error)
        }
        oldLevels = levels
      })
    }
    // Update monitor with the new bits to monitor
    monitorBits |= bits

    // start monitoring new bits
    request(NB, handle, monitorBits, 0)



    // return the callback 'id'
    return nob.id
  }
  that.pauseNotifications = function (cb) {
  // Caution:  This will pause **all** notifications!
    return request(NP, handle, 0, 0, cb)
  }
  that.stopNotifications = function (id, cb) {
    // Clear monitored bits and unregister callback
    var result
    for (let nob of notifiers.keys()) {
      if (nob.id === id) {
        monitorBits &= ~nob.bits // clear gpio bit in monitorBits
        // Stop the notifications on pigpio hardware
        result = request(NB, handle, monitorBits, 0, (err, res) => {
          // last callback with null arguments
          nob.func(null, null)
          notifiers.delete(nob)
          cb(err, res)
        })
      }
    }
    return result
  }
  that.closeNotifications = function (cb) {
  // Caution: This will close **all** notifications!
    return request(NC, handle, 0, 0, cb)
  }

  var isUserGpio = function (gpio) {
    return !!(((1 << gpio) & info.userGpioMask))
  }

  that.getInfo = function () {
    return (info)
  }
  that.getHandle = function () { return handle }
  that.getCurrentTick = function (cb) {
    return that.request(TICK, 0, 0, 0, cb)
  }
  that.readBank1 = function (cb) {
    return that.request(BR1, 0, 0, 0, cb)
  }
  that.hwClock = function (gpio, freq, cb) {
    return that.request(HC, gpio, freq, 0, cb)
  }

  that.destroy = function () {
    // Should only be called if an error occurs on socket
    commandSocket.destroy()
    notificationSocket.destroy()
  }
  that.end = function (cb) {
    commandSocket.end()       // calls disconnectHandler, destroys connection.
    notificationSocket.end()  // calls disconnectHandler, destroys connection.
    that.once('disconnected', () => {
      if (typeof cb === 'function') cb()
    })
  }

/* ___________________________________________________________________________ */

  that.gpio = function (gpio) {
    
    var _gpio = function (gpio) {
      assert(typeof gpio === 'number' && isUserGpio(gpio),
          "Argument 'gpio' is not a user GPIO.")
      var modeSet = function (gpio, mode, callback) {
        assert(typeof mode === 'string', "Argument 'mode' must be string.")
        let m = /^outp?u?t?/.test(mode) ? 1 : /^inp?u?t?/.test(mode) ? 0 : undefined
        assert(m !== undefined, "Argument 'mode' is not a valid string.")
        return request(MODES, gpio, m, 0, callback)
      }

      var pullUpDown = function (gpio, pud, callback) {
        assert(typeof pud === 'number', "Argument 'pud' is not a number.")
      // Rely on pigpio library to range check pud argument.
        return request(PUD, gpio, pud, 0, callback)
      }

  // basic methods
      this.modeSet = function (...args) { modeSet(gpio, ...args) }
      this.pullUpDown = function (...args) { pullUpDown(gpio, ...args) }
      this.write = function (level, callback) {
        assert(typeof level === 'number' && (level === 0 || level === 1),
          "Argument 'level' must be numeric 0 or 1")
        //if ((+level >= 0) && (+level <= 1)) {
          return request(WRITE, gpio, +level, 0, callback)
        //} else throw new MyError('gpio.write level argument must be numeric 0 or 1')
      }
      this.read = function (callback) {
        return request(READ, gpio, 0, 0, callback)
      }
      this.modeGet = function (callback) {
        return request(MODEG, gpio, 0, 0, callback)
      }
  // PWM
      this.analogWrite = function (dutyCycle, cb) {
        return request(PWM, gpio, dutyCycle, 0, cb)
      }
  // Notification methods
      var notifierID = null

      this.notify = function (callback) {
      // only allow one notifier per gpio object
        if (notifierID !== null) {
          that.emit('error', new MyError('Notifier already registered for this gpio.'))
          return
        }

        let gpioBitValue = 1 << gpio
        notifierID = that.startNotifications(gpioBitValue, (levels, tick) => {
        // When notifications are ended, last callback has null arguments
          if (levels === null) {
            return callback(null, null)
          }
          let level = (gpioBitValue & levels) >> gpio
          callback(level, tick)
        })
      }
      this.endNotify = function (cb) {
        if (notifierID !== null) {
          that.stopNotifications(notifierID, (err, res) => {
            notifierID = null
            if (cb && typeof cb === 'function')
              cb(err, res)
            else if (err)
              that.emit('error', new MyError(err))
          })
        }
      }
  // glitch
      this.glitchSet = function (steady, callback) {
        assert(typeof steady === 'number' && steady >= 0 && steady <= 300000,
          "Argument 'steady' must be a numeric bewtween 0 or 300000")
        return request(FG, gpio, steady, 0, callback)
      }

  // Waveform generation methods
      this.waveClear = function (callback) {
        return request(WVCLR, 0, 0, 0, callback)
      }
      this.waveCreate = function (callback) {
        return request(WVCRE, 0, 0, 0, callback)
      }
      this.waveBusy = function (callback) {
        return request(WVBSY, 0, 0, 0, callback)
      }
      this.waveNotBusy = function (time, cb) {
        let timer, callback

        if (typeof time !== 'number') {
          timer = 25
          callback = time
        } else {
          timer = time
          callback = cb
        }
        var promise = new Promise(function(resolve) {
          let originalCallback = callback
          callback = function() {
            if (typeof originalCallback === 'function') {
              originalCallback()
            }
            resolve()
          }
        })
        var waitWaveBusy = (done) => {
          setTimeout(() => {
            request(WVBSY, 0, 0, 0, (err, busy) => {
              if (!busy) done()
              else waitWaveBusy(done)
            })
          }, timer)
        }
        waitWaveBusy(callback)
        return promise
      }

      this.waveAddPulse = function (tripletArr, callback) {
      // test triplets is an array of arrays
        tripletArr.forEach(function (triplet) {
          assert.equal((Object.prototype.toString.apply(triplet)), '[object Array]', 'tripletArr not an array')
          assert.equal(triplet.length, 3, 'triplet array length is not 3')
        })

      // use Typed Arrays
        var arrBuf = new ArrayBuffer(tripletArr.length * 3 * 4)  // items are 3 x 32-bit values
        var uint32Triplet = new Uint32Array(arrBuf, 0, tripletArr.length * 3)  // 32-bit view of buffer
        let i = 0
        tripletArr.forEach(function (triplet) {
          uint32Triplet[i + 0] = triplet[0] << gpio // 'set' gpio (bit value)
          uint32Triplet[i + 1] = triplet[1] << gpio // 'clear' gpio (bit value)
          uint32Triplet[i + 2] = triplet[2]
          i = i + 3
        })
      // ship it
        return request(WVAG, 0, 0, arrBuf.byteLength, callback, arrBuf)
      }

      this.waveChainTx = function (paramArray, callback) {
      // Todo: assert paramArray elements are single property objects
        var chain = []
        paramArray.forEach((param) => {
          let temp
          if (param.hasOwnProperty('loop')) {
            temp = chain.concat(255, 0)
          } else if (param.hasOwnProperty('repeat')) {
            if (param.repeat === true) {
              temp = chain.concat(255, 3)            
            } else {
              assert.equal(param.repeat <= 0xffff, true, 'param must be <= 65535')
              temp = chain.concat(255, 1, param.repeat & 0xff, param.repeat >> 8)
            }
          } else if (param.hasOwnProperty('delay')) {
            assert.equal(param.delay <= 0xffff, true, 'param must be <= 65535')
            temp = chain.concat(255, 2, param.delay & 0xff, param.delay >> 8)
          } else if (param.hasOwnProperty('waves')) {
            param.waves.forEach((wid) => {
              assert.equal(wid <= 250, true, 'wid must be <= 250')
            })
            temp = chain.concat(param.waves)
          }
          chain = temp
          temp = []
        })

        var arrBuf = new ArrayBuffer(chain.length)
        var buffer = new Uint8Array(arrBuf)
        for (let i = 0; i < chain.length; i++) buffer[i] = chain[i]
        return request(WVCHA, 0, 0, arrBuf.byteLength, callback, arrBuf)
      }

      this.waveTxStop = function (cb) {
        return request(WVHLT, 0, 0, 0, cb)
      }
      this.waveSendSync = function (wid, cb) {
        return request(WVTXM, wid, PI_WAVE_MODE_ONE_SHOT_SYNC, 0, cb)
      }
      this.waveSendOnce = function (wid, cb) {
        return request(WVTXM, wid, PI_WAVE_MODE_ONE_SHOT, 0, cb)
      }
      this.waveTxAt = function (cb) {
        return request(WVTAT, 0, 0, 0, cb)
      }
      this.waveDelete = function (wid, cb) {
        return request(WVDEL, wid, 0, 0, cb)
      }

  // Pulse Width Modulation
      this.setPWMdutyCycle = function (dutyCycle, cb) { // alias of analogWrite
        return request(PWM, gpio, dutyCycle, 0, cb)
      }
      this.setPWMfrequency = function (freq, cb) {
        return request(PFS, gpio, freq, 0, cb)
      }
      this.getPWMdutyCycle = function (cb) {
        return request(GDC, gpio, 0, 0, cb)
      }
      this.hardwarePWM = function (frequency, dutyCycle, callback) {
        var arrBuf = new ArrayBuffer(4)
        var dcBuf = new Uint32Array(arrBuf, 0, 1)
        dcBuf[0] = dutyCycle
        return request(HP, gpio, frequency, 4, callback, arrBuf)
      }

  // Servo pulse width
      this.setServoPulsewidth = function (pulseWidth, cb) {
        return request(SERVO, gpio, pulseWidth, 0, cb)
      }
      this.getServoPulsewidth = function (cb) {
        return request(GPW, gpio, 0, 0, cb)
      }

  // Bit-Bang Serial IO
      this.serialReadOpen = function (baudRate, dataBits, callback) {
        var arrBuf = new ArrayBuffer(4)
        var dataBitsBuf = new Uint32Array(arrBuf, 0, 1)
        dataBitsBuf[0] = dataBits
        return request(SLRO, gpio, baudRate, 4, callback, arrBuf)
      }
      this.serialRead = function (count, callback) {
        return request(SLR, gpio, count, 0, callback)
      }
      this.serialReadClose = function (callback) {
        return request(SLRC, gpio, 0, 0, callback)
      }
      this.serialReadInvert = function (mode, callback) {
        var flag
        if (mode === 'invert') flag = 1
        if (mode === 'normal') flag = 0
        assert(typeof flag !== 'undefined', "Argument 'mode' is invalid.")
        return request(SLRI, gpio, flag, 0, callback)
      }
      this.waveAddSerial = function (baud, bits, delay, data, callback) {
        let dataBuf = Buffer.from(data)
        let paramBuf = Buffer.from(Uint32Array.from([bits, 2, delay]).buffer)
        let buf = Buffer.concat([paramBuf, dataBuf])
      // request take array buffer (this conversion from ZachB on SO)
      // let arrBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        return request(WVAS, gpio, baud, buf.length, callback, buf)
      }
    }// var gpio
    _gpio.prototype = that // inheritance
    return new _gpio(gpio)
  }// that.gpio constructor
/*
 *  Serial Port Constructor
 *
 *  Return a serialport object using specified pins.  Frame format is 1-32 databits,
 *  no parity and 1 stop bit.  Baud rates from 50-250000 are allowed.
 *  Usage: Application must poll for read data to prevent data loss.  Read method
 *  uses callback.  (Desire to make this readable.read() like)
 *  Todo: - make rts/cts, dsr/dtr more general purpose.
 *        - implement duplex stream api
 */
  that.serialport = function (rx, tx, dtr) {
    var _serialport = function (rx, tx, dtr) {
      if (dtr)
        assert(isUserGpio(rx) && isUserGpio(tx) && isUserGpio(dtr),
        "Arguments 'rx', 'tx', and 'dtr' must be valid user GPIO")
      else
        assert(isUserGpio(rx) && isUserGpio(tx),
        "Arguments 'rx' and 'tx' must be valid user GPIO")
      
      var baud, bits, isOpen=false, txBusy=false, maxChars, buffer=''
      var _rx, _tx, _dtr
      _rx = new that.gpio(rx)
      if (tx === rx) { // loopback mode
        _tx = _rx
      } else _tx = new that.gpio(tx)
      if (dtr)
        _dtr = (dtr === tx) ? _tx : new that.gpio(dtr)
      _rx.modeSet('input') // need a pullup?
      _tx.modeSet('output')
      _tx.write(1)
      if (dtr) {
        _dtr.modeSet('output')
        _dtr.write(1)
      }

      this.open = function (baudrate, databits, cb) {
        if (cb) assert(typeof cb === 'function',
            "argument 'cb' must be a function")
        baud = baudrate || 9600
        assert(typeof baud === 'number', "argument 'baud' must be a number")
        assert(!isNaN(baud) && baud > 49 && baud < 250001,
            "argument 'baud' must be a positive number between 50 and 250000")
        bits = databits || 8
        assert(typeof bits === 'number', "argument 'dataBits' must be a number")
        assert(!isNaN(bits) && bits > 0 && bits < 33,
            "argument 'dataBits' must be a positive number between 1 and 32")
          
        // initialize rx
        _rx.serialReadOpen(baud, bits, (err) => {
          if (err && err.code === 'PI_GPIO_IN_USE') {
            log("PI_GPIO_IN_USE, try close then re-open")
            _rx.serialReadClose((err) => {
              if (err) {
                log("something is wrong on retry open serial port")
                isOpen = false
                if (cb)
                  cb(createSPError(err), false)
                else that.emit(createSPError(err))
              }
              else _rx.serialReadOpen(baud, bits, (err) => {
                log("retrying open, abort on error")
                if (err) throw(createSPError(err))
                log("retry success")
                isOpen = true
                if (dtr && dtr !== tx) {
                  // pulse dtr pin to reset Arduino
                  _dtr.write(0, () => {
                    setTimeout(() => { _dtr.write(1) }, 10)
                  })
                }
                if (cb)
                  cb(null, true)
              })
            })
          } else if (err) { // unexpected error on open
            isOpen = false
            if (cb)
              cb(createSPError(err), false)
            else that.emit(createSPError(err))
          } else {
            // normal success
            isOpen = true
            if (dtr && dtr !== tx) {
              // pulse dtr pin to reset Arduino
              _dtr.write(0, () => {
                setTimeout(() => { _dtr.write(1) }, 10)
              })
            }
            if (cb)
              cb(null, true)
          }
        })
        
        // initialize tx
        _tx.waveClear((err) => {
          if (err) throw(createSPError(err))
          that.request(35, 2, 0, 0, (err, maxPulses) => {
            maxChars = maxPulses / (bits + 2)
            log('maxChars = ', maxChars)
          })
        })
      }

    /*
     * Read from serialport.  Arguments:
     *
     *  size  A number representing the number of bytes to read.  Size is optional.
     *        If not specified, all the data in the buffer is returned (<=8192).
     *
     *  cb    On success, invoked as cb(null, data) where 'data' is a string.
     *        On failure, invoked as cb(err) where 'err' is a PigpioError
     *        object.
    */
      this.read = function (size, cb) {
        let count, callb
        if (typeof size === 'function') {
          callb = size
          count = 8192
        } else {
          callb = cb
          count = size || 8192 // must read at least a byte at a time
        }
        if (isOpen) {
          _rx.serialRead(count, (err, len, ...bytes) => {
            if (err) {
              callb(createSPError(err))
            } else if (len === 0) {
              callb(null, null)
            } else {
              let buf = Buffer.from(bytes)
              callb(null, ""+buf) // coerce to string
            }
          })
        } else callb(null)
      }
      
      this.write = function (data) {
      /*  Saves data, coerced to utf8 string, to a buffer then sends chunks of
       *  of size 'maxChars' to waveAddSerial().  Returns the size (>=0) of buffer.
       *  If the serial port is not open, returns -1.  
       *  Pigpio errors will be thrown to limit possible data corruption.
      */
        if (isOpen === false)
          return -1
        
        buffer += data  // fast concatenation with coercion to string type
        if (txBusy)
          return buffer.length
        
        let chunk = buffer.slice(0, maxChars) // computed in serialport.open()
        buffer = buffer.slice(chunk.length)
        txBusy = true
        if (chunk) send(chunk)
        return buffer.length
        
        function send(data) {
          log('serialport sending data ', data.length)
          _tx.waveAddSerial(baud, bits, 0, data, (err) => {
            if (err) throw(createSPError(err))
            _tx.waveCreate( (err, wid)=> {
              if (err) throw(createSPError(err))
              _tx.waveSendOnce(wid, (err) => {
                if (err) throw(createSPError(err))
                setTimeout(() => {
                  _tx.waveNotBusy(1, () => {
                    _tx.waveDelete(wid, (err) => {
                      if (err) throw(createSPError(err))
                      if (buffer) {
                        chunk = buffer.slice(0, maxChars)
                        buffer = buffer.slice(chunk.length)
                        send(chunk)
                      }
                      else 
                        txBusy = false
                    })
                  })
                }, Math.ceil((data.length+1) * 10 * 1000 / baud))
              })
            })
          })
        }
      }

      this.close = function (callback) {
        if (isOpen) {
          isOpen = false
          _rx.serialReadClose((err) => {
            if(err && err.code === 'PI_NOT_SERIAL_GPIO')
              log('Serial read is already closed: '+err.message)
            else if (err) if (callback && typeof callback === 'function')
                               callback(createSPError(err))
                          else that.emit(createSPError(err))
          })
        }
        if (typeof callback === 'function') callback(null, 0)
      }
      this.end = function (callback) {
        if (callback)
          assert(typeof callback === 'function', "Argument 'cb' must be a function")
        this.close((err) => {
          if (err) if (callback)
                        callback(createSPError(err))
                   else that.emit(createSPError(err))
          _tx.modeSet('in', (err) => {
            if (err)  if (callback)
                           callback(createSPError(err))
                      else that.emit(createSPError(err))
            if (dtr)
              _dtr.modeSet('input', (err) => {
                if (err) if (callback)
                              callback(createSPError(err))
                         else that.emit(createSPError(err))
                // success, finally!
                if (callback)
                  callback()
              })
            else if (callback) callback()
          })
        })
      }
    }// _serialport()

    function createSPError(err) {
      return new MyError( { name: 'pigpioClientError',
                            api: 'serialport',
                            code: (typeof err === 'string')? 'PI_CLIENT' : err.code,
                            message: (typeof err === 'string')? err : err.message
      })
    }

    _serialport.prototype = that
    return new _serialport(rx, tx, dtr)
  }// pigpio serialport constructor

  /*
   * SPI functions
   */
  that.spi = function (channel) {
    var _spi = function (channel) {
      assert(typeof channel === 'number',
          "Argument 'channel' is not a number.");
      let handle;
      this.open = function(baud, spiFlags) {
        let arrBuf = new ArrayBuffer(4);
        let flagsBuf = new Uint32Array(arrBuf, 0, 1);
        flagsBuf[0] = spiFlags;
        let callback;
        let promise = new Promise((resolve, reject) => {
          callback = (error, res) => {
            if (error) {
              reject(error);
            } else {
              handle = res;
              resolve();
            }
          }
        });
        request(SPIO, channel, baud, 4, callback, arrBuf);
        return promise;
      };
      this.close = function(callback) {
        return request(SPIC, handle, 0, 0, callback) // always returns 0
      };
      /* data needs to be a buffer/Uint8Array */
      this.write = function(data, callback) {
        return request(SPIW, handle, 0, data.byteLength, callback, data);
      };
    }
    _spi.prototype = that;
    return new _spi(channel);
  }// pigpio spi constructor
  
  /*
   * File functions
   */
  that.file = function () {
    let _file = function () {
      let handle;
      // remoteFileName: string
      // mode: number (1,2,3 aka PI_FILE_READ, PI_FILE_WRITE, PI_FILE_RW)
      this.open = function(remoteFileName, mode) {
        let enc = new TextEncoder();  // always utf-8
        let remoteFileNameArr = enc.encode(remoteFileName);
        let callback;
        let promise = new Promise((resolve, reject) => {
          callback = (error, res) => {
            if (error) {
              reject(error);
            } else {
              handle = res;
              resolve();
            }
          }
        });
        request(FO, mode, 0, remoteFileNameArr.length, callback, remoteFileNameArr);
        return promise;
      };
      this.close = function (callback) {
        return request(FC, handle, 0, 0, callback);
      };
      // returns: normal array of bytes
      this.read = function (count) {
        let callback;
        let promise = new Promise((resolve, reject) => {
          callback = (error, len, ...bytes) => {
            if (error) {
              reject(error);
            } else if (len === 0) {
              resolve();
            } else {
              resolve(bytes);
            }
          }
        });
        request(FR, handle, count, 0, callback);
        return promise;
      };
      // offet: number (seek offset, uint32)
      // from: number (0,1,2 aka seek position PI_FROM_START, PI_FROM_CURRENT, PI_FROM_END)
      // returns: seek position
      this.seek = function (offset, from, callback) {
        let arrBuf = new ArrayBuffer(4);
        let fromBuf = new Uint32Array(arrBuf, 0, 1);
        fromBuf[0] = from;
        return request(FS, handle, offset, 4, callback, arrBuf);
      };
    }
    _file.prototype = that;
    return new _file();
  }// pigpio file constructor

  /*
   * I2C functions
   */
  that.i2c = function (bus, address) {
    var _i2c = function (bus, address) {
      assert(typeof bus === 'number', "Argument 'bus' is not a number.");
      assert(typeof address === 'number', "Argument 'address' is not a number.");
      let handle;
      this.open = function (i2cFlags) {
        let arrBuf = new ArrayBuffer(4);
        let flagsBuf = new Uint32Array(arrBuf, 0, 1);
        flagsBuf[0] = i2cFlags;
        let callback;
        let promise = new Promise((resolve, reject) => {
          callback = (error, res) => {
            if (error) {
              reject(error);
            } else {
              handle = res;
              resolve();
            }
          }
        });
        request(I2CO, bus, address, 4, callback, arrBuf);
        return promise;
      };
      this.close = function (callback) {
        return request(I2CC, handle, 0, 0, callback) // always returns 0
      };
      // returns: normal array of bytes
      this.read = function (count) {
        let callback;
        let promise = new Promise((resolve, reject) => {
          callback = (error, len, ...bytes) => {
            if (error) {
              reject(error);
            } else if (len === 0) {
              resolve();
            } else {
              resolve(bytes);
            }
          }
        });
        request(I2CRD, handle, count, 0, callback);
        return promise;
      };
      /* data needs to be a buffer/Uint8Array */
      this.write = function (data, callback) {
        return request(I2CWD, handle, 0, data.byteLength, callback, data);
      };
    }
    _i2c.prototype = that;
    return new _i2c(bus, address);
  }// pigpio i2c constructor

  return that
}// pigpio constructor

function MyError(settings, context) {
  settings = settings || {}
  if (typeof settings === 'string')
    settings = {message: settings}
  this.name = settings.name || "pigpioClientError"
  this.code = settings.code || "PI_CLIENT"
  this.message = settings.message || "An error occurred"
  this.api = settings.api || ""
  Error.captureStackTrace(this, context || MyError)
}
util.inherits(MyError, Error)
