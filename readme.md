# pigpio-client
Pigpio client uses the pigpiod socket interface running on a remote or localhost
Raspberry Pi to control its GPIO pins.  For the underlying detail of the pigpio 
socket interface see http://abyz.co.uk/rpi/pigpio/sif.html

### Usage
```
	const PigpioClient = require('pigpio-client');
	const myPi = new PigpioClient.pigpio({host:'localhost', port:8888});  
	const myPin = myPi.gpio(25);
	myPin.modeset('input'); // no callback
	var pinLevel;
	myPin.read((err,val)=>{ // read callback executes after modeSet
		if (err) errorHandler(err);
		else pinLevel = val;
	});
	// get notifications on GPIO25
	myPin.notify((buf)=> {
		//buf is Buffer object containing 16-bit sequence, 16-bit flags, 32-bit tick, 32-bit level
	});
	// you should monitor for errors
	myPi.on('error', (err)=> {
		console.log(err.message); // or err.stack
	});
```
Most pigpio-client methods are asynchronous and accept an optional callback function.  Asynchronous
methods called without providing a callback function will emit 'error' if a pigpio exeception is raised.
The application must supply an 'error' event handler in such cases.	Arguments to callback are: *(err, res, ...ext)*.

By default, network request and response to/from pigiod are ordered allowing pigpio commands to be sent back-
to-back without a callback (see usage example above).  Network socket requests can be pipelined, with the
pipelining property set to true in the constructor, but now the application must assure responses are received
in the corret order - usually done by chaining callbacks.

### Constructor
**pigpioClient({host: '192.168.1.12', port: 8765, pipelining: true})**:

Constructs a pigpio 
Client connected to 192.168.1.12:8765 with pipelining enabled.
Defaults are host=localhost, port=8888, pipelining=false.  On success,
returns pigpio client object.



## Methods
**pi.getInfo()**  Returns useful information about rpi hardware and pigpiod.  
**pi.getCurrentTick(cb)**  
**pi.readBank1(cb)**  
**pi.end(cb)**	Ends communications on command and notifications socket.  Callback issued after 'close' event is
received from both sockets.  
**pi.destroy()**  Runs socket.destroy() on both network sockets.  Todo: other cleanup.  
**pi.gpio(gpio_pin)** Construct a gpio object referring to gpio_pin.

**gpio.modeSet(mode, cb)**  Set mode of gpio to 'in[put]' or 'out[put]'.  
**gpio.modeGet(cb)**  Returns the mode of gpio as argument to callback.  
**gpio.pullUpDown(pud, cb)**  Sets the pullup or pulldown resistor for gpio.  
**gpio.read(cb)**  Returns the gpio level as argument to callback.  
**gpio.write(level, cb)**  Set the gpio level.  
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

**pi.startNotifications(bits, cb)**  
**pi.pauseNotifications(cb)**  
**pi.stopNotifications(id)**  

**gpio.notify(callback)** Registers a notification callback for this gpio.  Callback is called whenever the gpio state changes.  Callback arguments are *level* and *tick* where *tick* represents the system's time since boot.  
**gpio.endNotify()**  Unregisters the notification on gpio. For convenience, a null *tick* value is sent.  Useful for stream objects that wrap the notifier callback.  

### Bit\_Bang\_Serial Methods  
**gpio.serialReadOpen(baudRate, dataBits, cb)**   
**gpio.serialRead(count, cb)**  Callback returns (err,len,array)  
**gpio.serialReadClose(cb)**  
**gpio.serialReadInvert(mode, cb)**  Mode is 'invert' || 'normal'.  
**waveAddSerial(baud,bits,delay,data,cb)**  

### Serialport
**pi.serialport(rx,tx,dtr)**  Construct serial port using gpio pins rx,tx,dtr.  
**serialport.open(baudrate,databits,cb)**  Callback arg is null if sucessful, error message otherwise.  
**serialport.read(cb)**  Callback arg is null if no data available, else buffer object.  
**serialport.write(data)**  Data is string or buffer or array.  
**serialport.close(cb)**  Close serialport.  
**serialport.end(cb)**  Close bb_serial_read, disable outputs and undef serialport.  

### Bugs

### Todo
- Implement pigpiod error codes decoder.
- Simplify callback arguments to just err, res instead of err, res, ...len.  Res may be scalar or array.
- Notifications socket: check for notification errors response (res[3])?  See pigpio python code.
- test for callback queue underflow?
- Use waveSendSync in serialport.write to improve performance.
- Make serialport.read similar to readable.read api
- Add true flow control and modem support to serialport.read

### Ideas
- Waveforms should be accessible through a lock to gpio objects exclusive access during waveform creation/initialization, building or deletion.
- gpio objects keep track of their wave ids and delete them when gpio.end().  Avoids global clear waves.
- use gpio.waveTxAt to determine if another gpio wave is active (not in set of owned wave ids).
- keep track of gpio in use/avaiable, prevent overlapping gpio objects.

#### Running pigpiod with permissions
```
	$ sudo pigiod -s 1 # 1 microsecond sampling\
			-f # disable local pipe interface (ie pigs)\
			-n 10.0.0.13 # only allow host from my secure subnet
```
