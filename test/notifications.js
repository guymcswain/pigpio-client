'use strict'
/*
pigpio events test
*/
const config = {
  host: process.env.npm_package_config_host,
  port: 8888,
  pipelining: false,
  gpio: parseInt(process.env.npm_package_config_gpio, 10)
}
console.log('config = ' + JSON.stringify(config, null, 2))
const assert = require('assert')

const PigpioClient = require('../pigpio-client')
const pi = PigpioClient.pigpio(config)
console.log('Notifications test.  Waiting to connect ...')

pi.on('connected', (info) => {
  console.log(JSON.stringify(info, null, 2))
  console.log('\nRunning Notifications test')
  const gpio = pi.gpio(config.gpio)
  var gpioLevel
  var count = 0
  gpio.modeSet('out', () => {
    
    gpio.read( (err, level) => {
      if (err) throw new Error(err)
      gpioLevel = level
      gpio.notify( (level, tick) => {
        console.log(`level=${level}, tick=${tick}`)
        assert.equal(level, gpioLevel)
        count += 1
      })

      var loop = 0
      setTimeout(invertWriteWait, 200)
      //invertWriteWait()
      function invertWriteWait () {
        gpioLevel ^= 1
        gpio.write(gpioLevel, (err) => {
          if (err) throw new Error(err)
          setTimeout( () => {
            if (++loop !== 3) {
              invertWriteWait()
            }
            else {
              assert.equal(count, loop)
            }
          },200)
        })
      }
      
      
    })
  })
  
  
  
})

pi.on('error', (err) => console.log('pi error: '+err) )

setTimeout( () => {
  console.log('\tpass')
  pi.end( () => process.exit(0) )
}, 3000)

