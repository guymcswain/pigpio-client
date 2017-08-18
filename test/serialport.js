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
  pipelining: false,
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
  pi.request(35, 2, 0, 0, (err, res) => { // get wave statistics max pulses
    maxChars = res / 2 / (config.dataBits + 2) // double buffered, databits + start + stop
    runSerialPortTest()
  })

  function runSerialPortTest () {
    var rx = config.gpio,
      tx = rx,  // loopback: rx=tx
      dtr = tx // no dtr: dtr=tx
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
      console.log('Test 1:  Write back-to-back small chunks')
      let toSend = Buffer.from("Hello, I love you, won't you tell me your name?")
      serial.write(toSend.slice(0, 8))
      serial.write(toSend.slice(8, 19))
      serial.write(toSend.slice(19))
      loopReadTest(toSend, () => {
        console.log('Test 2:  Write back-to-back max chunks')
        let words = LoremIpsum({count: 100, units: 'sentences'})
        let chars = words.slice(0, maxChars)
        let sent = serial.write(chars)
        assert.strictEqual(sent, chars.length, 'serialport.write return value!')
        chars = words.slice(maxChars, maxChars * 2)
        sent = serial.write(chars)
        assert.strictEqual(sent, chars.length, 'serialport.write return value!')
        loopReadTest(Buffer.from(words.slice(0, maxChars * 2)), endTest)
      })
    })

    // reads data.length characters then compares data
    function loopReadTest (data, cb) {
      // console.log("loopReadTest called, size= "+data.length)
      setTimeout(() => {
        serial.read(data.length, (err, results) => {
          if (err) {
            throw new Error(err)
          }
          if (results === null) {
            return loopReadTest(data, cb)
          }
          if (results.length <= data.length) {
            // console.log(results.toString())
            if (results.compare(data, 0, results.length)) {
              console.log('\tFAIL!!!')
            } else {
              console.log('\tpass')
            }
            if (results.length === data.length) {
              if (cb !== undefined) return cb()
              return null
            }
            return loopReadTest(data.slice(results.length), cb)
          } else {
            throw new Error('results too big!')
          }
        })
      }, data.length * (config.dataBits + 2) * 1000 / config.baudRate + 20)
    }

    function endTest () {
      serial.close(() => {
        console.log('serial port closed')
        pi.end(() => {
          // let info = pi.getInfo()
          // console.log(info)
          pi.destroy()
          console.log('Goodbye')
        })
      })
    }

    // watchdog
    var wdog = setTimeout(() => {
      console.log('watchdog time out')
      endTest()
    }, 5000)
    wdog.unref()
  }// end runSerialPortTest()
})

pi.on('error', (err) => {
  console.log('!!!!! ' + err.message)
})
