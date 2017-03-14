# PIGPIO Client
Pigpio client uses the pigpiod socket interface running on a remote or localhost
Raspberry Pi to control its GPIO pins.  For the underlying detail of the pigpio 
socket interface see http://abyz.co.uk/rpi/pigpio/sif.html

###Usage
	const PigpioClient = require('./pigpio-client');
	const pigpio = new PigpioClient.Pigpio();  // rpi @ localhost, port 8888 (defaults)
	pigpio.modeSet(25, 'input'); // GPIO25 input pins
	var level = pigpio.read(25);
	// get notifications on gpio25
	const notifier = PigpioClient.Notifier(); // also localhost, port 8888
	notifier.start(1<<25);
	notifier.on('data', (buf)=> {
		//buf contains 16 bit sequence, 16 bit flags, 32 bit tick, 32 bit level
	});

Callback arguments are optional.  Network request and responses are serialized 
by default.  To enablepipeling of requests, set the pipelining configuration option to true.  Leave 
pipelining disabled as it appears pigpio doesn't work.


API - Update 12-2-15:  Callback arguments returned are now: (err, res, ...ext).

###Constructor
**Pigpio({hostname: host, port: port, pipelining: true})**:

Constructs a pigpio 
client connected to host:port with pipelining enabled.
Defaults are host=localhost, port=8888, pipelining=false.  On success,
returns pigpio client object.



###Methods
modeSet(gpio, mode):  Set gpio to 'in[put]' or 'out[put]'.

modeGet(gpio, mode):  Returns the mode of gpio.

pullUpDown(gpio, pud):  Sets the pullup or pulldown resistor for gpio.

read(gpio):  Returns the gpio level.

write(gpio, level):  Set the gpio level.

waveClear(): clear all waveforms (wids are all reset).

waveCreate(): Returns a wave id of waveform created from previous calls to
waveAddPulse().

waveBusy():  Returns 1 if true, 0 if false, <0 if error.

waveAddPulse(gpio, arrayOfPulse_t): Add one or more pulses to gpio of current
waveform.

waveChainTx([wids], {loop:x, delay:y}): Transmit a chain of wids.  Options object
specifies loop and delay (between loop) values.
	
###Todo
- (in testing) Notifications: Open a new connection to pigpiod and issue pigpio command 'NOIB'
which stands for 'notification open in-band.'  Return a notification object with methods:
	- start(gpioBitMask): starts notfications on gpio bits in bit mask
	- pause():  Pause further notifications.
	- stop():  Close the currently open socket, handle and free pigpio resources.
- noise filter
- incorporate  GPIO.js into common module.  ie Pigpio.Gpio()