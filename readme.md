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

Callback arguments are optional.  Network request and responses are serialized 
by default.  To enablepipeling of requests, set the pipelining configuration option to true.  Leave 
pipelining disabled as it is experimental.


API - Update 12-2-15:  Callback arguments returned are now: (err, res, ...ext).

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

waveClear(): clear all waveforms (wave IDs are all reset).

waveCreate(cb(wid)): Returns a wave id of waveform created from previous calls to waveAddPulse().  Wave ID
is the argument of callback.

waveBusy():  Returns 1 if true, 0 if false, <0 if error.

gpio.waveAddPulse([Pulse_t], cb): Add one or more pulses to gpio of current waveform.

waveChainTx([wids], {loop:x, delay:y}): Transmit a chain of wids.  Options object
specifies loop and delay (between loop) values.

Notifications: The pigpio-client object automatically opens a second connection to pigpiod and issues
pigpio command 'NOIB' (notification open in-band).  Notification methods apply only to gpio objects:

 - gpio.notify(callback): Registers a notification callback for this gpio.  Callback is called
	  whenever the gpio changes state.
 - gpio.endNotify():  Unregisters the notification on gpio.	

Added 3/16/2017 - bit-bang serial read methods  
gpio.serialReadOpen(baudRate, dataBits)  
gpio.serialRead(count, callback(err,length, ...bytes)  
gpio.serialReadClose()  
gpio.serialReadInvert('invert' || 'normal')  

###Bugs
- Inverted level on gpio.notify()

###Todo
- noise filter
- Notifications socket: check for notification errors response (res[3])
- refactor waveChainTx, see fixme comment
- test for callback queue underflow?