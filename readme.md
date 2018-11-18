# pigpio-client
The pigpio-client library allows you to connect to a remote Raspberry Pi running
the pigpio server (pigpiod) and manipulate its GPIO pins.  This library is implemented
 using the pigpio library socket interface.  For the underlying detail of the pigpio
 socket interface see http://abyz.co.uk/rpi/pigpio/sif.html

### Usage example
```javascript
  const PigpioClient = require('pigpio-client');
  const Pi = PigpioClient.pigpio({host: 'ip.v4.add.res', timeout: 5});  
  Pi.on('connected', (info) => {
    
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
  
  // When you don't provide a callback, errors are returned through events
  Pi.on('error', (err)=> {
    console.log(err.message); // or err.stack
  });
```
All APIs accept error-first callback as an optional last argument.  Depending 
on the presence of a callback argument, errors returned by pigpio are delivered in 
two ways:  Methods called without a callback emit 'error' events.  Methods called 
with a callback are supplied an `Error` object as the first argument returned.  
Arguments to callback are: `(error, response, ...extendedResponse)`.

If you prefer to use async/await, you can easily promisify (most) any api:
```javascript
const util = require('util');
const gpio.readAsync = util.promisify(gpio.read);
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
```

### Constructor
**`PigpioClient.pigpio(options)`**:
Construct a pigpio object and connect it to `options.host`.
  
Options have the following properties:
- host: <string> The remote IP address to host running pigpio daemon.  Defaults to 'localhost'.
- port: <number> The port used to configure pigpiod.  Default is 8888.
- pipelining: <boolean> DEPRECATED. Configures internal socket communications.
- timeout: <number> The network socket timeout in minutes. Default is 0.  

The *timeout* option is introduced in v1.1.0.  Values of 0 or >=3 are accepted.  A 
non-zero timeout value, in minutes, will enable automatic retries to connect to 
pigpiod when recoverable errors are encountered.  Recoverable errors are: 
`ECONNREFUSED` and `EHOSTUNREACH`.  During this timeout period, connection will be 
retried every 5 seconds.  After connection is established, if keep-alive packets 
are not received from pigpiod within *timeout* minutes, the network sockets will 
be closed and a 'disconnected' event emitted.

## Events
**`'connected'`**  Emitted after both command and notification sockets are connected 
to pigpiod.  An 'info' object is passed to the handler.  

**`'disconnected'`**  Emitted when the socket connections are closed by pigpiod or 
when no keep-alive packets were received within *timeout>0* minutes.  

**`'error'`**  Error event handler receives an Error object.  Pigpio errors will 
have `PI_ERROR` set on the `code` property.  Pigpio-client errors will have `PI_CLIENT_ERROR` 
set on the `code` property.  

## Methods
### pigpio methods
**`pigpio.gpio(gpio_pin)`** Return a gpio object referring to gpio_pin.  
**`pigpio.getInfo(cb)`**  Returns useful information about rpi hardware and pigpiod.  
**`pigpio.getCurrentTick(cb)`** Return current timer tick in microseconds.   
**`pigpio.readBank1(cb)`**  Read all gpio in bank1 (0-31).  These are the user gpio pins.  
**`pigpio.end(cb)`**  Ends communications on command and notifications socket.  Callback issued after 'close' event is received from both sockets.  
**`pigpio.destroy()`**  DEPRECATED.  Runs socket.destroy() on both network sockets.  
**`pigpio.connect()`**  After the 'disconnect' event, reconnect using this method.  
**`pigpio.serialport(rx,tx,dtr)`**  Return a serialport object using gpio pins rx,tx,dtr.  

### gpio basic methods
**`gpio.modeSet(mode, cb)`**  Set mode of gpio to 'in[put]' or 'out[put]'.  
**`gpio.modeGet(cb)`**  Returns the mode of gpio as argument to callback.  
**`gpio.pullUpDown(pud, cb)`**  Sets the pullup (pud=2) or pulldown (pud=1) resistor for gpio.  Pud=0 off.  
**`gpio.read(cb)`**  Returns the gpio pin level as argument to callback.  
**`gpio.write(level, cb)`**  Set the gpio pin to level.  
**`gpio.analogWrite(dutyCycle, cb)`**  See [pigpio library, gpioPWM](http://abyz.me.uk/rpi/pigpio/cif.html#gpioPWM).  Caution: This will stop all waveform generation.  

### gpio waveform methods
**`gpio.waveClear(cb)`** clear all waveforms (wave IDs are all reset).  
**`gpio.waveCreate(cb)`** Returns a wave id of waveform created from previous calls to waveAddPulse().  Wave ID is the argument of callback.  
**`gpio.waveBusy(cb)`**  Returns 1 if true, 0 if false, <0 if error.  
**`gpio.waveNotBusy(interval, cb)`**  Executes the callback when waveform ends.  Polls waveform status at interval msec.  Defaults to 25msec.  
**`gpio.waveAddPulse([Pulse_t], cb)`** Add array of *Pulse_t* to gpio of current waveform.  *Pulse_t* is a tuple [1, 0, delay] for positive pulse, [0, 1, delay] for negative pulse of delay width.  See [pigpio library, gpioWaveAddGeneric](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveAddGeneric).  
**`gpio.waveChainTx([wids], {loop:x, delay:y}, cb)`** Transmit a chain of wids.  Options object specifies loop and delay (between loop) values.  
**`gpio.waveSendSync(wid, cb)`**  Synchronizes the wave id to the currently active waveform.  
**`gpio.waveSendOnce(wid, cb)`**  Send the wave id, wid, one time.    
**`gpio.waveTxAt(cb)`**  Return currently active wave id, no wave being transmitted (9999) or wave not found (9998).  
**`gpio.waveDelete(wid, cb)`**  Delete the wave id.  

*Note:  `waveClear`, `waveCreate` and `waveBusy` are not gpio specific.  These methods 
are made available to the gpio object for convenience and as a reminder that only 
a single waveform can be active.*  
*Note: `waveBusy` and `waveNotBusy` return status are global indication of waveform state - not specific to gpio!*  

### gpio notification methods
**`gpio.notify(function)`** Registers a notification call to function.  Function is called whenever the gpio state changes.  Arguments are *level* and *tick* where *tick* represents the system's time since boot.  
**`gpio.endNotify(cb)`**  Unregisters the notification on gpio. For convenience, a null *tick* value is sent.  Useful for stream objects that wrap the notifier callback.  

### gpio bit\_bang\_serial methods  
**`gpio.serialReadOpen(baudRate, dataBits, cb)`**   
**`gpio.serialRead(count, cb)`**  Callback returns (err,len,array)  
**`gpio.serialReadClose(cb)`**  <add text>  
**`gpio.serialReadInvert(mode, cb)`**  Mode is 'invert' || 'normal'.  
**`waveAddSerial(baud,bits,delay,data,cb)`**  

### serialport methods
**`serialport.open(baudrate,databits,cb)`**  Callback arg is null if sucessful, error message otherwise.  
**`serialport.read(cb)`**  Callback arg is null if no data available, else buffer object.  
**`serialport.write(data)`**  Data is string or buffer or array.  Returns null if data cannot be written.  The write
buffer size is 1200 characters (8-bit data).  
**`serialport.close(cb)`**  Close serialport.  
**`serialport.end(cb)`**  Close bb_serial_read, disable outputs and undef serialport.  

### Bugs
https://github.com/guymcswain/pigpio-client/issues


#### Limitations
Only a single instances of pigpio, gpio and serialport are supported.  **<=1.1.x**
#### Installing and Running pigpiod plus other useful information
see [pigpio-client wiki](https://github.com/guymcswain/pigpio-client/wiki/Install-and-configure-pigpiod)
