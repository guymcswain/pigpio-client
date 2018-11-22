const pigpio = require('../pigpio-client.js').pigpio({host: '192.168.100.2'});  
pigpio.once('connected', (info) => {
  // display information on pigpio and connection status
  console.log(JSON.stringify(info,null,2));
  
  // control an LED on GPIO 25
  const LED = pigpio.gpio(25);
  LED.modeSet('output');
  LED.write(1); // turn on LED
  LED.write(0); // turn off
  LED.analogWrite(128); // set to 50% duty cycle (out of 255)
  
  // get events from a button on GPIO 17
  const Button = pigpio.gpio(17);
  Button.modeSet('input');
  Button.notify((level, tick)=> {
    console.log(`Button changed to ${level} at ${tick} usec`)
  });
});

// Errors are emitted unless you provide API with callback.
pigpio.on('error', (err)=> {
  console.log('Application received error: ', err.message); // or err.stack
});
pigpio.on('disconnected', (reason) => {
  console.log('App received disconnected event, reason: ', reason);
  console.log('App reconnecting in 1 sec');
  setTimeout( pigpio.connect, 1000, {host: '192.168.100.2'});
});
exports.pigpio = pigpio
/*
const promisify = require('util').promisify;
const gpio.readAsync = promisify(gpio.read);
(async() => {
  let level;
  try {
    level = await gpio.readAsync();
    console.log('The gpio level is: ', level);
    //...
  } catch(e) {
    console.log(e.code, e.message) // pigpio error message
  }
}());
*/