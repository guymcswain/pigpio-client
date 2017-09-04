'use strict'
/*
This script tests a serial port created using pigpio-client (ie bit-bang).  The
serial port is configured in a loop-back configuration (rx==tx==drt) allowing a
single unused pin for testing on the raspberry pi.
Caution:  This test uses GPIO25 configured as an output.  Verify that you don't
have anything connected to this pin or choose another unused pin when
constructing serialport object.

Usage:
  0. Install pigpio daemon on hosting raspberry pi:
      sudo apt-get install pigpio
  1. Run the pigpio daemon on the host:
      sudo pigpiod
  2. Configure your npm environment:
      npm config set pigpio-client:host 'ip address of your rpi'
      npm config set pigpio-client:gpio 'unused gpio number'
  3. npm test
*/
const config = {
  host: process.env.npm_package_config_host,
  port: 8888,
  pipelining: true,
  gpio: parseInt(process.env.npm_package_config_gpio, 10),
  baudRate: parseInt(process.env.npm_package_config_baud, 10),
  dataBits: 8
}
console.log('config = ' + JSON.stringify(config, null, 2))
const assert = require('assert')
const LoremIpsum = require('lorem-ipsum')

const PigpioClient = require('../pigpio-client')
const pi = PigpioClient.pigpio(config)
console.log('Serial port test.  Waiting to connect ...')

pi.on('connected', (info) => {
  console.log(JSON.stringify(info, null, 2))

  var maxChars
   // set maximum characters from wave statistics max pulses and baud rate
  pi.request(35, 2, 0, 0, (err, res) => {
    if (err) throw new Error(err)
    maxChars = res / 2 / (config.dataBits + 2) // double buffered, databits + start + stop
    runSerialPortTest()
  })

  function runSerialPortTest () {
    var rx = config.gpio
    var tx = rx  // loopback: rx=tx
    var dtr = tx // no dtr: dtr=tx
    var serial = pi.serialport(rx, tx, dtr)
    if (serial === undefined) {
      console.log('Failed to create serialport object, exiting test!')
      pi.end()
      return
    }

    serial.open(config.baudRate, config.dataBits, (err) => {
      if (err) {
        console.log(err)
        return endTest()
      }
      console.log('serial port open')

      console.log('\nTest 1: Write back-to-back small chunks')
      let toSend = Buffer.from("Hello, I love you, won't you tell me your name?")
      serial.write(toSend.slice(0, 8), (err) => {
        if (err) throw err
        serial.write(toSend.slice(8, 19), (err) => {
          if (err) throw err
          serial.write(toSend.slice(19), (err) => {
            if (err) throw err
          })
        })
      })

      var words = LoremIpsum({count: 50, units: 'sentences'})

      loopReadTest(toSend, test2)
      function test2 () {
        console.log('\nTest 2: Write back-to-back max chunks')

        let chars = words.slice(0, maxChars)
        let sent = serial.write(chars, (err) => {
          if (err) throw err
          assert.strictEqual(sent, undefined, 'serialport.write return value!')
          chars = words.slice(maxChars, maxChars * 2)
          sent = serial.write(chars, (err) => {
            if (err) throw err
            assert.strictEqual(sent, undefined, 'serialport.write return value!')
            loopReadTest(Buffer.from(words.slice(0, maxChars * 2)), streamTest)
          })
        })
      }

      // configure a serialport stream
      const { Duplex, Stream } = require('stream')
      class SP extends Duplex {
        constructor (options) {
          super(options)
          options = options || {}
          options.allowHalfOpen = false // not sure this is necessary
          this.reading = false
          serial.on('data', (data) => {
            // if (data)
            // console.log(`${data.length} bytes received`)
            if (!this.push(data) || !data) {
              serial.readStop()
              this.reading = false
            }
          })
        }
        _read (size) {
          if (!this.reading) {
            serial.readStart()
            this.reading = true
          }
          // console.log('sp_read called!')
        }
        _write (chunk, enc, callback) {
          sendSerial(chunk, callback)
          function sendSerial (data, cb) {
            if (data.length) {
              // let size = Math.floor(Math.random() * (600 - 500 + 1) + 500) // 500 to 600
              let size = maxChars
              let chunklet = data.slice(0, size)
              data = data.slice(size)
              serial.write(chunklet, (err) => {
                if (err) return cb(err)
                // console.log(`serial.write ${chunklet.length} bytes`)
                sendSerial(data, cb)
              })
            } else {
              // console.log('sendSerial return')
              return cb(null)
            }
          }

          // serial.write(chunk, callback)
        }
      }

      function streamTest () {
        console.log('\nTest 3: Stream test')
        pi.request(27, 0, 0, 0) // waveClear
        var sp = new SP()
        var bufferStream = new Stream.PassThrough()
        var wordBuf = new Buffer.from(words)
        var result = new Buffer.allocUnsafe(0)

        bufferStream.pipe(sp).on('data', spDataHandler)
        function spDataHandler (data) {
          result = Buffer.concat([result, data])
          if (result.length === wordBuf.length) {
            if (result.compare(wordBuf)) {
              console.log('\tFAIL!!!')
            } else {
              console.log('\tpass')

              // Visually check of beginning and end of strings
              // console.log(result.slice(0,40).toString()+result.slice(-40).toString())
              // console.log(wordBuf.slice(0,40).toString()+wordBuf.slice(-40).toString())
            }

            serial.close() // results in 'end' event
          }
        }
        sp.on('finish', () => {
          // console.log('sp "finish" event received')
        })
        sp.on('close', () => console.log('sp "close" event received'))
        sp.on('end', () => {
          // console.log('sp "end" event received')
          // sp.removeListener('data', spDataHandler)
          endTest()
        })
        sp.on('error', (err) => {
          // console.log('serialport '+err)
          throw err
        })

        bufferStream.end(wordBuf)
        sp.end(null) // end the write stream
      }
    })// serial.open()

    // reads data.length characters then compares data
    function loopReadTest (dataSent, cb) {
      var results = []
      waitThenRead(dataSent, cb)
      function waitThenRead (data, cb) {
        setTimeout(read
          , data.length * (config.dataBits + 2) * 1000 / config.baudRate + 20
          , data
          , cb
          )
      }
      function read (data, cb) {
        serial.read(data.length, (err, result) => {
          if (err) {
            throw new Error(err)
          }
          if (result === null) {
            // console.log('result === null!')
            return waitThenRead(data, cb)
          }
          if (result.length <= data.length) {
            results.push(result)
            if (result.length === data.length) {
              results = Buffer.concat(results)
              if (results.compare(dataSent)) {
                console.log('\tFAIL!!!')
                console.log(results.toString())
              } else {
                console.log('\tpass                              ')
              }
              if (cb !== undefined) return cb()
              return null
            } else {
              return waitThenRead(data.slice(result.length), cb)
            }
          }

          // exception, result too large
          throw new Error('result too big!')
        })
      }
    }

    function endTest () {
      serial.close(() => {
        console.log('\nserial port closed')
        pi.end(goodbye)
        function goodbye () {
            // let info = pi.getInfo()
            // console.log(info)
          pi.destroy()
          console.log('Goodbye')
            // process.exit(0)
        }
      })
    }

    // watchdog
    var wdog = setTimeout(() => {
      console.log('watchdog time out')
      endTest()
    }, 300000)
    wdog.unref()
  }// end runSerialPortTest()
})

pi.on('error', (err) => {
  console.log('!!!!! ' + err.message)
})
