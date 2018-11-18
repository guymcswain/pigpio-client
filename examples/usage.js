const PigpioClient = require('../pigpio-client.js');
  const Pi = PigpioClient.pigpio({host: '192.168.100.2', timeout: 0.4});  
  Pi.once('connected', (info) => {
    
    // display information on pigpio and connection status
    console.log(JSON.stringify(info,null,2))
    
    // control an LED on GPIO 25
    const LED = Pi.gpio(25);
    LED.modeSet('output');
    LED.write(1); // turn on LED
    LED.write(0); // turn off
    LED.analogWrite(128); // set to 50% duty cycle (out of 255)
    
    // get events from a button on GPIO 17
    const Button = Pi.gpio(17);
    Button.modeSet('input');
    Button.notify((level, tick)=> {
      console.log(`Button changed to ${level} at ${tick} usec`)
    });
  }); //Pi.on 'connected'
  
  // When you don't provide API with callback, errors are returned through events
  Pi.on('error', (err)=> {
    console.log('Application received error: ', err.message); // or err.stack
  });
  Pi.on('disconnected', (reason) => {
    console.log('App received disconnected event, reason: ', reason);
    console.log('App reconnecting in 1 sec');
    setTimeout( Pi.connect, 1000, {host: '192.168.100.2'});
  });