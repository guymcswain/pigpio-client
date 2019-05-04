'use strict'
const debug = require('debug')('regression-1.0.3')
const assert = require('assert')
const PigpioClient = require('../pigpio-client')
const pigpio_client_config = {
  host: process.env.npm_package_config_host,
  port: 8888,
  pipelining: true
}
const GPIO = parseInt(process.env.npm_package_config_gpio, 10)
const Pi = PigpioClient.pigpio(pigpio_client_config)
const PI_PULL_UP=2 , PI_PULL_DOWN=1, PI_PUD_OFF=0 , PI_INPUT=0 , PI_OUTPUT=1
const NestedError = require('nested-error-stacks')
Pi.on('error', (e) => {
  debug('Unhandled exception!!!')
  throw new NestedError("Unhandled pigpio-client error!", e)
})
Pi.on('connected', (info) => {
  debug(JSON.stringify(info, null, 2))
  var gpio = Pi.gpio(GPIO)
  // use async methods
  const util = require('util')
  Pi.requestAsync = util.promisify(Pi.request)
  gpio.modeSetAsync = util.promisify(gpio.modeSet)
  gpio.modeGetAsync = util.promisify(gpio.modeGet)
  gpio.pullUpDownAsync = util.promisify(gpio.pullUpDown)
  gpio.readAsync = util.promisify(gpio.read)
  gpio.writeAsync = util.promisify(gpio.write)
  Pi.readBank1Async = util.promisify(Pi.readBank1)
  Pi.getCurrentTickAsync = util.promisify(Pi.getCurrentTick)
  gpio.waveAddPulseAsync = util.promisify(gpio.waveAddPulse)
  gpio.waveCreateAsync = util.promisify(gpio.waveCreate)
  gpio.waveClearAsync = util.promisify(gpio.waveClear)
  gpio.waveSendOnceAsync = util.promisify(gpio.waveSendOnce)
  gpio.waveBusyAsync = util.promisify(gpio.waveBusy)
  gpio.waveSendSyncAsync = util.promisify(gpio.waveSendSync)
  gpio.waveNotBusyAsync = util.promisify(gpio.waveNotBusy)
  gpio.serialReadOpenAsync = util.promisify(gpio.serialReadOpen)
  gpio.serialReadCloseAsync = util.promisify(gpio.serialReadClose)
  gpio.endNotifyAsync = util.promisify(gpio.endNotify)
  Pi.endAsync = util.promisify(Pi.end)
 
  ;(async function() {
    let test
    try {
      
      test = 'pigpio error test'
      process.stderr.write(`Running ${test} ... `)
      let result = await testPigpioError()
      process.stderr.write(`${result}\n`)
      
      test = 'Basic API test'
      process.stderr.write(`Running ${test} ... `)
      await testBasicApis()
      process.stderr.write(' PASS\n')

      test = 'Notifications test'
      process.stderr.write(`Running ${test} ... `)
      await testNotifications()
      process.stderr.write(' PASS\n')

      test = 'Waves test'
      process.stderr.write(`Running ${test} ... `)
      await testWaves()
      process.stderr.write(' PASS\n')

      test = 'Serialport test'
      process.stderr.write(`Running ${test} ... `)
      await testSerialport()
      process.stderr.write(' PASS\n')

      await Pi.endAsync()
      console.log('\n\nAll tests passed!')
      process.exit()
    }
    catch(e) {
      //process.stderr.write(`FAIL!!! ${test}: ${e.message}\n`)
      process.stderr.write(`${e.message}\n`)
      //console.log(e.stack)
      Pi.end( ()=> {
        process.exit()
      })
    }
    
    throw("Things did not end well!")

  })()

function testPigpioError() {
// Error Reporting
  return new Promise(async(resolve, reject) => {
    const SIF = require('../SIF.js')
    // pigpio supported commands:
    const { BR1, BR2, TICK, HWVER, PIGPV, PUD, MODES, MODEG, READ, WRITE, PWM, WVCLR,
    WVCRE, WVBSY, WVAG, WVCHA, NOIB, NB, NP, NC, SLRO, SLR, SLRC, SLRI, WVTXM, WVTAT,
    WVDEL, WVAS, HP, HC, GDC, PFS} = SIF.Commands
    const BAD_USER_GPIO = 32, BAD_PARAM=999, BAD_PARAM_NEG=-1, BAD_PARAM_BIG=300001

    let err
    try {
    // pigpio errors - asynchronous calls!
      
      err = await onErrorBackResolve(Pi.request, MODEG, 62, 0, 0)
      assert.strictEqual(err.code, 'PI_BAD_GPIO', 'wrong error code')
      assert(err.name === 'pigpioError', "wrong error name")
      assert(err.api === 'MODEG', "wrong api")
      debug(`\nPASS ${err.name}, ${err.message}, ${err.api}`)
      
      err = await onErrorBackResolve(Pi.request, WRITE, GPIO, BAD_PARAM, 0)
      assert.strictEqual(err.code, 'PI_BAD_LEVEL', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      err = await onErrorBackResolve(Pi.request, PWM, BAD_USER_GPIO, 0, 0)
      assert.strictEqual(err.code, 'PI_NOT_PERMITTED', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      err = await onErrorBackResolve(Pi.request, MODES, GPIO, BAD_PARAM, 0)
      assert.strictEqual(err.code, 'PI_BAD_MODE', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      err = await onErrorBackResolve(Pi.request, WVDEL, BAD_PARAM, 0, 0)
      assert.strictEqual(err.code, 'PI_BAD_WAVE_ID', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      /* Hangs pigpio!!!!
      err = await onErrorBackResolve(Pi.request, WVTXM, GPIO, BAD_PARAM, BAD_PARAM)
      assert.strictEqual(err.code, 'PI_BAD_WAVE_MODE', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      */
      
      try { await gpio.serialReadCloseAsync()}
      catch(e) {debug(`gpio ${(e?'is not':'is')} bit bang serial`)}
      
      err = await onErrorBackResolve(Pi.request, SLR, GPIO, 0, 0) // >=0
      assert.strictEqual(err.code, 'PI_BAD_SERIAL_COUNT', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      err = await onErrorBackResolve(Pi.request, SLR, GPIO, 1, 0) // not yet open
      assert.strictEqual(err.code, 'PI_NOT_SERIAL_GPIO', 'wrong error code')
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
    // pigpio-client assertion errors
      
      // api checks gpio paramter
      err = onThrowErrorResolve(Pi.gpio, BAD_USER_GPIO)
      assert.strictEqual(err.code,
        'ERR_ASSERTION', "gpio constructor did not check bad 'gpio' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      // api checks mode is string
      err = onThrowErrorResolve(gpio.modeSet, 'alt-0')
      assert.strictEqual(err.code, 'ERR_ASSERTION',
        "modeSet did not check bad 'mode' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      // api checks write level
      err = onThrowErrorResolve(gpio.write, BAD_PARAM)
      assert.strictEqual(err.code, 'ERR_ASSERTION',
        "write method did not check 'level' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)
      
      // api relies on pigpio to check bad 'pud' parameter
      err = await onErrorBackResolve(gpio.pullUpDown, BAD_PARAM)
      assert.strictEqual(err.code,
        'PI_BAD_PUD', "pigpio did not range check 'pud' argument.")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)

      // api check glitch set
      err = onThrowErrorResolve(gpio.glitchSet, 'string-0')
      assert.strictEqual(err.code, 'ERR_ASSERTION',
        "glitchSet did not check bad 'steady' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)

      err = onThrowErrorResolve(gpio.glitchSet, BAD_PARAM_NEG)
      assert.strictEqual(err.code, 'ERR_ASSERTION',
        "glitchSet did not check bad 'steady' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)

      err = onThrowErrorResolve(gpio.glitchSet, BAD_PARAM_BIG)
      assert.strictEqual(err.code, 'ERR_ASSERTION',
        "glitchSet did not check bad 'steady' argument")
      debug(`PASS ${err.name}, ${err.message}, ${err.api}`)

    }

    catch(e) {
      console.log(e)
      reject(new Error(`FAIL - pigpio error: ${e.message}`))
      
    }
    
    resolve('PASS')
  })
  
  function onErrorBackResolve(fn, ...args) {
    return new Promise( async(resolve, reject) => {
      try {  
        fn(...args, (err, res) => {
          if (err) return resolve(err)
          debug('GOT REJECTED!!!')
          //reject(new Error({ name: fn.name, message: 'API did not error-back'+res}))
          reject(new Error(`API did not error-back. res=${res}`))
        })
      }
      catch(e) {
        reject(new NestedError('Fatal error!', e))
      }
    })
  }
  
  function onThrowErrorResolve(fn, ...args) {
      try {  
        // Call function that is expected to throw exception - synchronously
        fn(...args)
        debug('function failed to throw!')
        // the following returns an empty object (why?), but works to trigger assertion anyway
        return new Error('API did not throw error')
      }
      catch(e) {
        //debug('Got exception onThrowErrorResolve')
        return e
      }
  }
}
  
function testBasicApis() {
// Basic GPIO APIs
  return new Promise(async(resolve, reject) => {
    try {
      // modeSet/Get, pullUpDown
      await gpio.modeSetAsync('input')
      let mode = await gpio.modeGetAsync()
      assert.strictEqual(mode, PI_INPUT, "modeSet/Get input")
      await gpio.pullUpDownAsync(PI_PULL_UP)
      let level = await gpio.readAsync()
      assert.strictEqual(level, 1, "gpio input did not pull-up")
      //await gpio.writeAsync(0)
      //level = await gpio.readAsync()
      //assert.strictEqual(level, 1, "gpio with pull-up failed after writing 0")
      await gpio.pullUpDownAsync(PI_PULL_DOWN)
      level = await gpio.readAsync()
      assert.strictEqual(level, 0, "gpio input did not pull-down")
      //await gpio.writeAsync(1)
      //level = await gpio.readAsync()
      //assert.strictEqual(level, 0, "gpio with pull-down failed after writing 1")
      
      // read and write
      await gpio.modeSetAsync('output')
      mode = await gpio.modeGetAsync()
      assert.strictEqual(mode, PI_OUTPUT, "modeSet/Get output")
      await gpio.writeAsync(1)
      level = await gpio.readAsync()
      assert.strictEqual(level, 1, "gpio write 1") // from earlier write
      await gpio.writeAsync(0)
      level = await gpio.readAsync()
      assert.strictEqual(level, 0, "gpio write 0")
      await gpio.pullUpDownAsync(PI_PUD_OFF)
      
      // bank1
      let g = process.env.npm_package_config_gpio
      let bank1 = await Pi.readBank1Async()
      assert.strictEqual(bank1&2**g, 0)
      await gpio.writeAsync(1)
      bank1 = await Pi.readBank1Async()
      assert.strictEqual(bank1&2**g, 2**g, "readBank1")
      
      // Todo:
      if (process.env.npm_package_version > '1.0.3') {
        // PAD, associated fd or functions (ie, serialOpen, PWM)
        // Write a 'status dump' like API that reports all info per GPIO
      }
    } catch(e) {
      
      if (typeof e === 'string') e = new Error(e)
      debug("Basic APIs: ", e.message)
      reject(e)
    }
    resolve()
  })
}

function testNotifications() {  
// Notifications
  return new Promise( async(resolve, reject) => {
    try {
      var iter = 5, level = 1, tickSent, tickNow
      var eventQ = [], ev
      await gpio.modeSetAsync('output')
      await gpio.writeAsync(level^1) // init to NOT level

      // setup notifier callback
      gpio.notify( (level, tick) => {
        eventQ.push({level: level, tick: tick})
      })
/* Not in v1.1.0
      // verify we can open two notifications on same gpio
      gpio.notify( () => {})
*/      
      // await for notifications to begin
      if (info.pigpioVersion <= 67) {
        debug('Delay 1 minute for pigpio V67')
        await sleep(60100) // Fixme
      }
      else {
        debug('Delay 100 ms for pigpio-client 1.0.3')
        await sleep(100) // Fixme
      }
      // set a watchdog timer in case events not received
      let wdog = setTimeout(()=> {throw("Notifications timed out")}, 1000)
      
      // generate event, wait for it, then validate it
      for (let i=0; i<iter; i++) {
        
        Pi.getCurrentTick( (err, tick) => {
          tickSent = tick
          debug('tickSent= ', tickSent)
        })
        debug('start write to level= ', level)
        gpio.write(level)
        
        
        while (!(ev=eventQ.shift())) // Fixme: undefined when empty, not null?
          await sleep(1);
        tickNow = await Pi.getCurrentTickAsync()
        assert.strictEqual(ev.level, level, "Notification level")
        assert.strictEqual((ev.tick - tickSent) < (tickNow - tickSent), true, "Notification tick")
        level ^= 1 // invert level
      }
      clearTimeout(wdog)
      
      if (eventQ.length) debug(`${eventQ.length} events remaining in queue!`)
      
      await gpio.endNotifyAsync()

      await gpio.writeAsync(level)
      
      // verify last event is 'null event'
      ev = eventQ.shift()
      if (!(ev.level===null && ev.tick===null)) {
        debug("Unexpected event in event queue", ev)
        throw "Notifications did not end with '{level: null, tick: null}'"
      }
      // done
    } catch(e) {
      
      if (typeof e === 'string') e = new Error(e)
      debug("Notifications: ", e.message)
      reject(e)
    }
    resolve()
  })
}

function testWaves() {
// Waves
  return new Promise( async(resolve, reject) => {
    var eventQ = []
    try {
      await gpio.pullUpDownAsync(PI_PUD_OFF)
      await gpio.modeSetAsync('output')
      await gpio.writeAsync(0) // init
      // define waves as array of value change data tuples of type: [level, time(us)]
      const W1 = [ [1,      0], [0,    250], // 250 us pulse at 0 msec
                   [1, 100000], [0, 100500], // 500 us pulse at 1 msec
                   [1, 200000], [0, 200750], // 750 us pluse at 2 msec
                   [0, 300000] ]
      
      // helper function to convert to gpioPulse_t
      var vcd2pulse_t = function (vcd, gpio) {
        let g = (gpio===undefined) ? 0 : gpio
        if (typeof g !== 'number') throw "vcd2pulse_t requires gpio number"
        let pulse_t = [] // array of tuples: [onBitValue, offBitValue, delay(us)]
        let level, time, bitval = 2**g
        let lastLevel, lastTime
        for (let key of vcd.keys()) {
          if (key === 0) [lastLevel, lastTime] = vcd[key]
          else {
            [level, time] = vcd[key]
            pulse_t.push([bitval*lastLevel, bitval*(lastLevel^1), time-lastTime])
            ;[lastLevel, lastTime] = vcd[key]
          }
        }
        return pulse_t
      }
      let triplets = vcd2pulse_t(W1)
      debug(triplets)
      
      // create the waves on pigpio
      await gpio.waveClearAsync()
      let pulses = await gpio.waveAddPulseAsync(triplets)
      let wid = await gpio.waveCreateAsync()
      assert.strictEqual(wid, 0, "Wave ID not reset")
      debug(`wave id ${wid} created with ${pulses} pulses`)
      
      // setup notifier callback
      gpio.notify( (level, tick) => {
        eventQ.push({level: level, tick: tick})
      })
      // await for notifications to begin
      if (info.pigpioVersion <= 67) {
        debug('Delay 1 minute for pigpio V67')
        await sleep(60100) //
      }
      else {
        debug('Delay 100 ms for pigpio-client 1.0.3')
        await sleep(100) // Fixme
      }
      // send waves then wait for completion
      debug('sending wave')
      await gpio.waveSendOnceAsync(wid)
      let wdog = setTimeout(dumpEventQandThrowError, 500)
      
      while (await gpio.waveBusyAsync()) await sleep(25)
      clearTimeout(wdog)
      debug('waves sent')
      await sleep(200)
      debug(`${eventQ.length} events in queue`)
      //debug(eventQ)
      //assert.strictEqual(eventQ.length, 6, 
      //  `Event queue length=${eventQ.length} expected 6`)
      
      // prep results for comparison
      let result = eventQ.slice(0,6)
      debug('result=', result)
      let offset = result[0].tick
      let tupleList = []
      result.forEach( (tuple) => {
        tupleList.push([tuple.level, tuple.tick - offset])
      })
      debug('tupleList=', tupleList)
      // compare result to expect W1
      for (let i=0; i<tupleList.length; i++) {
        debug(`compare iter=${i}: ${tupleList[i][0]}, ${W1[i][0]}`)
        assert.strictEqual(tupleList[i][0], W1[i][0], "Waves level")
        assert.strictEqual(Math.abs(tupleList[i][1] - W1[i][1]) < 20, true, "Waves tick")
      }
      
      /******************/ 
      debug('create two more waves')
      await gpio.waveDelete(wid)
      pulses = await gpio.waveAddPulseAsync(triplets)
      let wid1 = await gpio.waveCreateAsync()
      assert.strictEqual(wid1, 0, "Wave 0 did not delete")
      debug(`wave id ${wid1} created with ${pulses} pulses`)
      
      pulses = await gpio.waveAddPulseAsync(triplets)
      let wid2 = await gpio.waveCreateAsync()
      assert.strictEqual(wid2, 1, "Wave ID not incrementing")
      debug(`wave id ${wid2} created with ${pulses} pulses`)
      
      debug('send wave back-to-back using waveSendSync then waveNotBusy')
      await gpio.waveSendOnceAsync(wid1)
      await gpio.waveSendSyncAsync(wid2)
      wdog = setTimeout(dumpEventQandThrowError, 1000)
      
      await gpio.waveNotBusyAsync()
      clearTimeout(wdog)
      
      debug('waves sent')
      await sleep(200)
      debug(`${eventQ.length} events in queue`)
      //debug(eventQ)
      //assert.strictEqual(eventQ.length, 6, 
      //  `Event queue length=${eventQ.length} expected 6`)
      
      // prep results for comparison
      result = eventQ.slice(0,6)
      debug('result=', result)
      offset = result[0].tick
      tupleList = []
      result.forEach( (tuple) => {
        tupleList.push([tuple.level, tuple.tick - offset])
      })
      debug('tupleList=', tupleList)
      // compare result to expect W1
      let j
      for (let i=0; i<tupleList.length; i++) {
        j = i % 6
        debug(`compare iter=${i}: ${tupleList[i][0]}, ${W1[j][0]}`)
        assert.strictEqual(tupleList[i][0], W1[j][0], "Waves level")
        assert.strictEqual(Math.abs(tupleList[i][1] - W1[j][1]) < 20, true, "Waves tick")
      }
      
      // Todo:  gpio.waveChainTx, gpio.waveTxAt
    
    } catch(e) {
      
      if (typeof e === 'string') e = new Error(e)
      debug("Waves: ", e.message)
      reject(e)
    }
    resolve()
    
    function dumpEventQandThrowError() {
      debug("Event Queue:")
      let ev
      while (ev = eventQ.shift()) {
        debug('\t', ev)
      }
      throw new Error('Timed out waiting for waves to send')
    }
    // done
  })
}

function testSerialport() {
// Serialport
  return new Promise( async(resolve, reject) => {
    
    const LoremIpsum = require('lorem-ipsum')
    const LOREMIPSUM = LoremIpsum({count: 100, units: 'sentences'})
    const BUF = Buffer.from(LOREMIPSUM)
    const BAUDRATE = parseInt(process.env.npm_package_config_baud, 10)
    const DATABITS = 8
    
    try {
      var rx = GPIO,
          tx = GPIO,  // loop-back
          dtr = GPIO,  // no DTR
          sp = Pi.serialport(rx, tx, dtr)
      assert.strictEqual(sp !== undefined, true, "Can't create SP, bad GPIO")
      sp.openAsync = util.promisify(sp.open)
      sp.readAsync = util.promisify(sp.read)
      sp.writeAsync = util.promisify(sp.write)
      sp.closeAsync = util.promisify(sp.close)
      sp.endAsync = util.promisify(sp.end)
      
      let mode = await gpio.modeGetAsync()
      assert.strictEqual(mode, 1, "tx incorrect mode")
      
      debug('open serialport')
      let spStatus
      try { spStatus = await sp.openAsync(BAUDRATE, DATABITS) } 
      catch(e) { debug(e.message) } // catch error if already open
      assert.strictEqual(spStatus, true, "failed to open serialport")
      debug('open serialport again, without closing')
      try { spStatus = await sp.openAsync(BAUDRATE, DATABITS) } 
      catch(e) { debug(e.message) } // catch error if already open
      assert.strictEqual(spStatus, true, "failed to open serialport")
      
      debug('check that all DMA control blocks are released')
      let maxPulses = await Pi.requestAsync(35, 2, 0, 0)
      let maxChars = maxPulses / (DATABITS + 2) // databits + start + stop
      assert.strictEqual(maxChars, 1200, "waveforms are not cleared")
      debug("check the serial read buffer is clear")
      assert.strictEqual(await sp.readAsync(), null, "sp read buffer not cleared")
      
      debug('Part 1) send words as Buffer in small chunks (8 chars)')
      //await sp.closeAsync() // uncomment to fail while loop assertion
      let count = 0 
      while (count <= BUF.length) {
        sp.write(BUF.slice(count, count+8))
        count += 8
        await sleep(1)
      }
      
      debug('read back serial data and compare result')
      let wdog = setTimeout(()=> {throw("SP timeout #1 reading")}, 2000)
      let result = ""
      while (result.length < BUF.length) {
        let res = await sp.readAsync()
        if (res) result += res  //= Buffer.concat([result, res])
      }
      clearTimeout(wdog)
      assert.strictEqual(LOREMIPSUM, result, 0, 'SP read #1 failed, result='+result)
      
      debug('Part 2) send words as string, no chunking')
      sp.write(LOREMIPSUM)

      debug('read back and compare')
      wdog = setTimeout(()=> {throw("SP timeout #2 reading")},
                 (LOREMIPSUM.length+1) * (DATABITS + 2) * 1000 / BAUDRATE + 1000)
      result = ""
      while (result.length < LOREMIPSUM.length) {
        let res = await sp.readAsync()
        if (res) result += res
      }
      clearTimeout(wdog)
      assert.strictEqual(LOREMIPSUM, result.toString(), 0, 
          'SP read #2 failed')
      
      debug('close sp, verify tx mode is still output')
      await sp.closeAsync()
      mode = await gpio.modeGetAsync()
      assert.strictEqual(mode, 1, "tx incorrect mode")
      
      debug('end sp, verify tx mode is now input')
      await sp.endAsync()
      mode = await gpio.modeGetAsync()
      assert.strictEqual(mode, 0, "tx mode not input after close")

      //done
    }
    catch(e) {
      debug(e)
      if (typeof e === 'string') e = new Error(e)
      debug("Serialport: ", e.message)
      reject(e)
    }
    resolve()
  })
}

function sleep(interval) {
  return new Promise(resolve => setTimeout(resolve, interval))
}

})// connected handler
