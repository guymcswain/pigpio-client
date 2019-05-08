# pigpio-client
The pigpio-client library allows you to connect to a remote Raspberry Pi running
the pigpio server - pigpiod - and manipulate its GPIO pins.  This library is implemented 
using the pigpio library socket interface.  For the underlying detail of the pigpio 
socket interface see http://abyz.me.uk/rpi/pigpio/sif.html  

[v1.2.0](https://github.com/guymcswain/pigpio-client/wiki) introduces new APIs: glitchSet, setServoPulsewidth, getServoPulseWidth.

### Usage example
```javascript
const pigpio = require('pigpio-client.js').pigpio({host: 'raspberryHostIP'});  
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
  setTimeout( pigpio.connect, 1000, {host: 'raspberryHostIP'});
});
```
All APIs accept error-first callback as an optional last argument.  Depending 
on the presence of a callback argument, errors returned by pigpio are delivered in 
two ways:  Methods called without a callback emit 'error' events.  Methods called 
with a callback are supplied an `Error` object as the first argument returned.  
Arguments to callback are: `(error, response)` unless otherwise noted.

If you prefer to use async/await, you can easily promisify (most) any api:
```javascript
const promisify = require('util').promisify;
gpio.readAsync = promisify(gpio.read);

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

### Constructors
**`PigpioClient.pigpio(options)`**:
Construct a pigpio object and connect it to `options.host`.
  
Options have the following properties:
- host: <string> The remote IP address to host running pigpio daemon.  Defaults to 'localhost'.
- port: <number> The port used to configure pigpiod.  Default is 8888.
- pipelining: <boolean> DEPRECATED. Configures internal socket communications.
- timeout: <number> The network socket timeout in minutes. Default is 0. *Timeout* 
enables automatic retries to connect to the server when recoverable errors -
`ECONNREFUSED` and `EHOSTUNREACH` - are encountered. During the timeout period, 
connection will be retried every 5 seconds.  After connection is established, if 
keep-alive packets are not received from the server within *timeout* minutes, the 
network sockets will be closed and a 'disconnected' event emitted.  If *timeout* 
is used, it is recommended to set its value to > 1 minute.  Also recommended is to 
use V68 of pigpio library.  

**`pigpio.gpio(gpio_pin)`** Return a gpio object set to the Broadcom GPIO number 
specified by gpio_pin. An error will be thrown if gpio_pin is not a valid user GPIO.  

**`pigpio.serialport(rx,tx,dtr)`**  Return a serialport object constructed from GPIO 
pins for rx, tx and dtr.  Rx and Tx may use the same pin for a loop-back.  DTR pin 
is optional.  An error will be thrown if the pins are not valid user GPIO.  Constructing
a serialport object will clear all waveforms.

## Events
**`'connected'`**  Emitted after both command and notification sockets are connected 
to pigpiod.  An 'info' object is passed to the handler.  You should wait for this 
event before attempting to construct other objects - gpio, serialport.

**`'disconnected'`**  Emitted when the socket connections are closed by pigpiod or 
when no keep-alive packets were received within *timeout>0* minutes.  

**`'error'`**  Error objects are passed to the 'error' event handler unless a callback 
was provided when invoking an API.  Pigpio errors have the `name` property set to 
`PigpioError` and a `code` and `message` property set corresponding the numeric value 
returned by the socket interface.  For pigpio-client specific APIs, the error `name` 
is set to `PigpioClientError`.
  

## Methods
### pigpio methods

**`pigpio.getInfo(cb)`**  Returns useful information about rpi hardware and pigpiod.  

**`pigpio.getCurrentTick(cb)`** Return current timer tick in microseconds.  [`gpioTick`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioTick)   

**`pigpio.readBank1(cb)`**  Returns levels of GPIO bits 31-0.  [`gpioRead_Bits_0_31`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioRead_Bits_0_31)  

**`pigpio.end(cb)`**  Ends socket communications.  Callback is invoked on `'disconnected'` event.  

**`pigpio.destroy()`**  DEPRECATED.  Invokes socket.destroy() on both network sockets.  

**`pigpio.connect()`**  Re-establishes communication with server after being disconnected.  


### gpio basic methods
**`gpio.modeSet(mode, cb)`**  Sets the gpio mode to be input or output.  The mode 
argument must be `string` with a value of `'input'`, `'in'`, `'output'` or `'out'`.
The optional callback is invoked with either `null` argument on success or `error` 
on failure.  

**`gpio.modeGet(cb)`**  Returns the mode of gpio as argument to callback. [`gpioGetMode`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioGetMode)  

**`gpio.pullUpDown(pud, cb)`**  pud=2: set pullup resistor, pud=1: set pulldown
resistor, pud=0: clear resistor setting.[`gpioSetPullUpDown`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioSetPullUpDown)  

**`gpio.read(cb)`**  Returns the gpio pin level as argument to callback.  

**`gpio.write(level, cb)`**  Sets the gpio output level to on (1) or off (0). If 
PWM or servo pulses are active on the gpio they are switched off. [`gpioWrite`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWrite)  

**`gpio.analogWrite(dutyCycle, cb)`**  Set the PWM dutycycle (0-255) on the gpio.  Caution: 
This will stop all waveform generation. [`gpioPWM`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioPWM).  

**`gpio.setServoPulsewidth(pulseWidth, cb)`** Starts servo pulses on gpio. Pulsewidth can be set to 0 (off) and from 500 (most anti-clockwise) to 2500 (most clockwise). Be aware that you can damage your servo when setting a too high pulseWidth. A value of 1500 (mid-point) is a good starting point to check range of your servo. [`gpioServo`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioServo)  

**`gpio.getServoPulsewidth(cb)`** Returns the pulsewidth of gpio as argument to callback. [`gpioGetServoPulsewidth`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioGetServoPulsewidth)  

### gpio waveform methods
**`gpio.waveClear(cb)`** Clear all waveforms (release DMA control blocks, reset wave IDs). [`gpioWaveClear`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveClear)  

**`gpio.waveCreate(cb)`** Returns the wave id of waveform created from previous calls 
to `waveAddPulse` or `waveAddSerial`.  [`gpioWaveCreate`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveCreate)    

**`gpio.waveBusy(cb)`**  Returns 1 if wave is still transmitting, otherwise 0. [`gpioWaveTxBusy`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveTxBusy)  

**`gpio.waveNotBusy(interval, callback)`**  Invokes `callback` when waveform ends. 
Polls waveform status at interval msec.  Defaults to 25msec.  

**`gpio.waveAddPulse([Pulse_t], cb)`** Add array of *Pulse_t* to gpio of current 
waveform.  *Pulse_t* is a tuple [1, 0, delay] for positive pulse, [0, 1, delay] 
for negative pulse width = delay. [`gpioWaveAddGeneric`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveAddGeneric).  

**`gpio.waveChainTx([wids], {loop:x, delay:y}, cb)`** Transmit a chain of waves 
represented by array of wave IDs `wids`.  Options object specifies `loop` and `delay` 
(between loop) values. [`gpioWaveChain`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveChain)  

**`gpio.waveSendSync(wid, cb)`**  Synchronizes `wid` to the currently active 
waveform. [`gpioWaveTxSend` with mode set to PI_WAVE_MODE_ONE_SHOT_SYNC.](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveTxSend)    

**`gpio.waveSendOnce(wid, cb)`**  Send the wave id, `wid`, one time. [`gpioWaveTxSend` with mode set to PI_WAVE_MODE_ONE_SHOT.](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveTxSend)  

**`gpio.waveTxAt(cb)`**  Return currently active wave id, no wave being transmitted 
(9999) or wave not found (9998). [`gpioWaveTxAt`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveTxAt)  

**`gpio.waveDelete(wid, cb)`**  Delete the wave id `wid`. [`gpioWaveDelete`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveDelete)  

*Note:  `waveClear`, `waveCreate` and `waveBusy` are not gpio specific.  These methods 
are made available to the gpio object for convenience and as a reminder that only 
a single waveform can be active.*  
*Note: `waveBusy` and `waveNotBusy` return status are global indication of waveform state - not specific to gpio!*  

### gpio notification methods
**`gpio.notify(callback)`** Registers the notification function `callback`.  `callback` 
is invoked whenever the gpio state changes.  Arguments to `callback` are *level* 
and *tick* where *tick* represents the system's time since boot.  

**`gpio.endNotify(cb)`**  Unregisters the notification on gpio. For convenience, 
a null *tick* value is sent - useful for stream objects that wrap the notifier callback.  

**`gpio.glitchSet(steady, cb)`** Sets a glitch filter (0-300000) on gpio in microseconds. Only effects notifications.
[`gpioGlitchFilter`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioGlitchFilter)  

### gpio bit\_bang\_serial methods  
**`gpio.serialReadOpen(baudRate, dataBits, cb)`** - [`gpioSerialReadOpen`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioSerialReadOpen)   

**`gpio.serialRead(count, cb)`**  Returns cb(null, length, buf). *buf* is Uint8Array
of length *length*. [`gpioSerialRead`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioSerialRead)  

**`gpio.serialReadClose(cb)`**  <add text>[`gpioSerialReadClose`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioSerialReadClose)  

**`gpio.serialReadInvert(mode, cb)`**  Mode is 'invert' || 'normal'. [`gpioSerialReadInvert`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioSerialReadInvert)  

**`waveAddSerial(baud,bits,delay,data,cb)`**  - [`gpioWaveAddSerial`](http://abyz.me.uk/rpi/pigpio/cif.html#gpioWaveAddSerial)

### serialport methods 
##### Experimental, these APIs may change in the future.  
**`serialport.open(baudrate,databits,cb)`**  Argument *baudRate* must be a number
from 50 to 250000.  Argument *dataBits* must be a number from 1 to 32. If the rx gpio 
is already open for bit-bang serial read the method will close the gpio and then
re-open it.  

**`serialport.read(size, cb)`**  *size* is an optional argument representing the 
number of bytes to read. If not specified, all the data in pigpio's cyclic buffer 
is returned (up to 8192 bytes).  Returns *cb(null, data)* where data is a utf8 
string.  If the serialport is not open, returns *cb(null)*.  

**`serialport.write(data)`**  *data* is utf8 string or Uint8Buffer.  The *data* is
buffered then sent out in chunk sizes that fit the available waveform resources.
Returns the number of bytes remaining in the buffer.  If the serialport is not open,
returns -1.  Any pigpio errors occurring during write will be thrown to limit the
possibility of data corruption.

**`serialport.close(cb)`**  Close serialport.  

**`serialport.end(cb)`**  Closes rx gpio for bb_serial_read and changes gpios tx and
dtr mode to input.  

### Environment Variables for Debugging
Environment variables can be set to display messages from pigpio-client to assist 
in troubleshooting your application.  DEBUG='pigpio' will enable status messages. 
For tracing the all socket communication use: PIGPIO=1.
```
DEBUG='pigpio' node myApp.js
```

### Issues/Requests/Questions
https://github.com/guymcswain/pigpio-client/issues


#### Limitations
Only a single instance of serialport is supported.  **<=1.1.x**

#### Installing and Running pigpiod plus other useful information
see [pigpio-client wiki](https://github.com/guymcswain/pigpio-client/wiki/Install-and-configure-pigpiod)
