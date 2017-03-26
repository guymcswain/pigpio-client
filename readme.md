# PIGPIO Client
Pigpio client uses the pigpiod socket interface running on a remote or localhost
Raspberry Pi to control its GPIO pins.  For the underlying detail of the pigpio 
socket interface see http://abyz.co.uk/rpi/pigpio/sif.html

###Usage
	const PigpioClient = require('pigpio-client');
	const myPi = new PigpioClient.pigpio({host:'localhost', port:8888});  
	const myPin = myPi.gpio(25);
	myPin.modeset('input'); // GPIO25 is input
	var myPinLevel;
	myPin.read((err,val)=>{
		if (!err) myPinLevel = val;
	});
	// get notifications on GPIO25
	myPin.notify((buf)=> {
		//buf is Buffer object containing 16-bit sequence, 16-bit flags, 32-bit tick, 32-bit level
	});
	// you should monitor for errors
	myPi.on('error', (err)=> {
		console.log(`pigpio error = ${err}`);
	});

Arguments to callback are: (err, res, ...ext).
Callbacks arguments are optional in most cases.  Network request and responses are serialized 
allowing pigpio commands to be sent back-to-back without waiting for a response.  Network socket requests
can be pipelined but this feature is experimental.  Pipelining default is disabled.

###Constructor
**pigpioClient({host: '192.168.1.12', port: 8765, pipelining: true})**:

Constructs a pigpio 
Client connected to 192.168.1.12:8765 with pipelining enabled.
Defaults are host=localhost, port=8888, pipelining=false.  On success,
returns pigpio client object.



###Methods
pgio.modeSet(mode):  Set mode of gpio to 'in[put]' or 'out[put]'.

gpio.modeGet(callback(mode)):  Returns the mode of gpio as argument to callback.

pgio.pullUpDown(pud):  Sets the pullup or pulldown resistor for gpio.

gpio.read(callback(level)):  Returns the gpio level as argument to callback.

gpio.write(level):  Set the gpio level.

gpio.waveClear(): clear all waveforms (wave IDs are all reset).

gpio.waveCreate(cb(wid)): Returns a wave id of waveform created from previous calls to waveAddPulse().  Wave ID
is the argument of callback.

gpio.waveBusy():  Returns 1 if true, 0 if false, <0 if error.

gpio.waveAddPulse([Pulse_t], cb): Add one or more pulses to gpio of current waveform.  Pulse_t is 
[gpioOn, gpioOff, delay]

gpio.waveChainTx([wids], {loop:x, delay:y}): Transmit a chain of wids.  Options object
specifies loop and delay (between loop) values.

Note:  waveClear, waveCreate and waveBusy are not gpio specific.  These methods are made available to the
gpio object for convenience and as a reminder that only a single waveform can be active.  (Is this true?)

pi.end():  Ends communications on command and notifications socket.  Callback issued after 'close' event is
received for notification socket.

pi.destroy():  Destroys command and notification sockets.

####Notifications
The pigpio-client object automatically opens a second connection to pigpiod for notifications on gpio pins.
This is done by issuing the 'NOIB' (notification open in-band) command to the command socket.

gpio.notify(callback): Registers a notification callback for this gpio.  Callback is called
	  whenever the gpio state changes.  Callback arguments are *level* and *tick* where *tick* represents
	  the system's time since boot.  
gpio.endNotify():  Unregisters the notification on gpio. For convenience, a null *tick* value is sent.
	  Useful for stream objects that wrap the notifier callback.

####bit-bang serial read methods  
gpio.serialReadOpen(baudRate, dataBits)  
gpio.serialRead(count, callback(err,length, ...bytes)  
gpio.serialReadClose()  
gpio.serialReadInvert('invert' || 'normal')  

gpio.waveTxAt():  return currently actie wid  
gpio.waveSendSync(wid): synchronizes the wid to the currently active waveform.  
gpio.waveDelete(wid): delete this wid.  Note: Bad things can happen if wid is currently active.

###Bugs
- Inverted level on gpio.notify()
- Notify returns incorrect time every so often.  Suspect that fractional chunk is not processing correctly.

###Todo
- noise filter
- Notifications socket: check for notification errors response (res[3])
- refactor waveChainTx, see fixme comment
- test for callback queue underflow?