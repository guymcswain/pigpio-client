# pigpio-client
Pigpio client uses the pigpiod socket interface running on a remote or localhost
Raspberry Pi to control its GPIO pins.  For the underlying detail of the pigpio 
socket interface see http://abyz.co.uk/rpi/pigpio/sif.html

### Usage
```
  const PigpioClient = require('pigpio-client');
  const pi = new PigpioClient.pigpio({host:'localhost', port:8888});  
  pi.on('connected', (info) => {
    
    // display information on pigpiod and connection status
    console.log(JSON.stringify(info,null,2))
    
    // configure GPIO25 as input pin and read its level
    const myPin = pi.gpio(25);
    myPin.modeSet('input');
    
    // the read is held in queue to run after modeSet response is returned guaranteeing in order execution
    var pinLevel;
    myPin.read( (err,val) => {
      if (err) errorHandler(err);
      else pinLevel = val;
    });
    
    // get notifications on GPIO25
    myPin.notify((level, tick)=> {
      //level is the pin's level, tick is 32-bit time in microseconds
    });
    
    // you should monitor for errors
    pi.on('error', (err)=> {
      console.log(err.message); // or err.stack
    });
  }); //Pi.on 'connected'
```
Most pigpio-client methods are asynchronous and accept an optional callback function.  Asynchronous
methods called without providing a callback function will emit 'error' if a pigpio exeception is raised.
The application must supply an 'error' event handler in such cases.  Arguments to callback are: *(err, res, ...ext)*.

By default, network request and response to/from pigpiod are ordered allowing pigpio-client commands to be sent back-
to-back without a callback (see usage example above).  Network socket requests can be pipelined, with the
pipelining property set to true in the constructor, but now the application must assure responses are received
in the corret order - usually done by chaining callbacks.

### Constructor
**pigpioClient.pigpio({host: '192.168.1.12', port: 8765, pipelining: true})**:

Constructs a pigpio client connected to 192.168.1.12:8765 with pipelining enabled.
Defaults are host=localhost, port=8888, pipelining=false.  On success, returns pigpio client object.

## Events
**'connected'**  Emitted after both command and notification sockets recieve 'connect' from pigpiod.
**'error'**  Emitted on network socket errors, gpio.notify errors or when pigpio command requested receives an error response and no callback was attached.

## Methods
**pi.getInfo()**  Returns useful information about rpi hardware and pigpiod.  
**pi.getCurrentTick(cb)**  
**pi.readBank1(cb)**  
**pi.end(cb)**  Ends communications on command and notifications socket.  Callback issued after 'close' event is received from both sockets.  
**pi.destroy()**  Runs socket.destroy() on both network sockets.  Todo: other cleanup.  
**pi.gpio(gpio_pin)** Construct a gpio object referring to gpio_pin.

**gpio.modeSet(mode, cb)**  Set mode of gpio to 'in[put]' or 'out[put]'.  
**gpio.modeGet(cb)**  Returns the mode of gpio as argument to callback.  
**gpio.pullUpDown(pud, cb)**  Sets the pullup (pud=2) or pulldown (pud=1) resistor for gpio.  Pud=0 off.
**gpio.read(cb)**  Returns the gpio pin level as argument to callback.  
**gpio.write(level, cb)**  Set the gpio pin to level.  
**gpio.analogWrite(dutyCycle, cb)**  

**gpio.waveClear(cb)** clear all waveforms (wave IDs are all reset).  
**gpio.waveCreate(cb)** Returns a wave id of waveform created from previous calls to waveAddPulse().  Wave ID is the argument of callback.  
**gpio.waveBusy(cb)**  Returns 1 if true, 0 if false, <0 if error.  
**gpio.waveNotBusy(interval, cb)**  Executes callback when waveform ends.  Polls at interval msec or 25msec if not specified.  
*Note, this is a global indication of waveform generation.  Not specific to gpio!*  
**gpio.waveAddPulse([Pulse_t], cb)** Add array of *Pulse_t* to gpio of current waveform.  *Pulse_t* is [gpioOn, gpioOff, delay]  
**gpio.waveChainTx([wids], {loop:x, delay:y})** Transmit a chain of wids.  Options object specifies loop and delay (between loop) values.  
*Note:  waveClear, waveCreate and waveBusy are not gpio specific.  These methods are made available to the gpio object for convenience and as a reminder that only a single waveform can be active.*  **(Is this true?)**  
**gpio.waveSendSync(wid, cb)**  Synchronizes the wave id to the currently active waveform.  
**gpio.waveSendOnce(wid, cb)**  Delete this wave id.  Note: Bad things can happen if wid is currently active.  
**gpio.waveTxAt(cb)**  Return currently active wave id, no wave being transmitted (9999) or wave not found (9998).  
**gpio.waveDelete(wid, cb)**  Delete the wave id.

### Notifications
The pigpio-client object automatically opens a second connection to pigpiod for notifications on gpio pins.
This is done by issuing the 'NOIB' (notification open in-band) command to the command socket.

**gpio.notify(callback)** Registers a notification callback for this gpio.  Callback is called whenever the gpio state changes.  Callback arguments are *level* and *tick* where *tick* represents the system's time since boot.  
**gpio.endNotify(cb)**  Unregisters the notification on gpio. For convenience, a null *tick* value is sent.  Useful for stream objects that wrap the notifier callback.  

### Bit\_Bang\_Serial Methods  
**gpio.serialReadOpen(baudRate, dataBits, cb)**   
**gpio.serialRead(count, cb)**  Callback returns (err,len,array)  
**gpio.serialReadClose(cb)**  
**gpio.serialReadInvert(mode, cb)**  Mode is 'invert' || 'normal'.  
**waveAddSerial(baud,bits,delay,data,cb)**  

### Serialport
**pi.serialport(rx,tx,dtr)**  Construct serial port using gpio pins rx,tx,dtr.  All waveforms are cleared.  
**serialport.open(baudrate,databits,cb)**  Callback arg is null if sucessful, error message otherwise.  
**serialport.read(cb)**  Callback arg is null if no data available, else buffer object.  
**serialport.write(data)**  Data is string or buffer or array.  Returns null if data cannot be written.  The write
buffer size is 1200 characters (8-bit data).  
**serialport.close(cb)**  Close serialport.  
**serialport.end(cb)**  Close bb_serial_read, disable outputs and undef serialport.  

### Bugs
https://github.com/guymcswain/pigpio-client/issues

Please run the serial port test using npm test.  Set up your npm environment as follows:  
npm config set pigpio-client:host 'ip address of your rpi'  
npm config set pigpio-client:gpio 'unused gpio number'  

#### Limitations
Only a single serial port instance is supported.  **v1.0.x**
#### Running pigpiod with permissions
```
  $ sudo pigpiod -s 1 # 1 microsecond sampling\
      -f # disable local pipe interface (ie pigs)\
      -n 10.0.0.13 # only allow host from my secure subnet
```
