/*
 Constructor of a pigpio client object that connects with a remote raspberry
 pi and allows manipulation of its gpio pins.
 */
const assert = require('assert');
const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}

// commands 
const BR1=10,BR2=11,TICK=16,HWVER=17,PIGPV=26,PUD=2,MODES=0,MODEG=1;
const READ=3,WRITE=4,PWM=5,WVCLR=27,WVCRE=49,WVBSY=32,WVAG=28,WVCHA=93;
const NOIB=99,NB=19,NP=20,NC=21;
// These command types return p3 as int32, otherwise p3 = uint32
// ie, if (canNeverFailCmdSet.has(cmdValue)) console.log('int32')
const canNeverFailCmdSet = new Set ([HWVER, PIGPV, BR1, BR2, TICK]);
const extReqCmdSet = new Set ([WVCHA, WVAG]);
const extResCmdSet = new Set (); // so far none implemented
/* pud */ 
const PUD_OFF = 0, PUD_DOWN = 1, PUD_UP = 2;
var info = {
	host: 'localhost',
	port: 8888,
	pipelining: false,
	conn1: false,
	conn2: false,
	pigpioVersion: '',
	hwVersion: '',
	hardware_type: 2, // 26 pin plus 8 pin connectors (ie rpi model B)
	userGpioMask: 0xfbc6cf9c,
}
/*****************************************************************************/
exports.pigpio = function(pi) {
	var requestQueue = [];
	var callbackQueue = [];
	const net = require('net');
	// update info
	info.host = pi.host || info.host;
	info.port = pi.port || info.port;
	info.pipelining = pi.pipelining || info.pipelining;
	
	// constructor object inherits from EventEmitter
	var that = new MyEmitter(); // can't use prototypal inheritance
	
// Command socket
	var commandSocket = net.createConnection(info.port, info.host, ()=> {
		//'connect' listener
		
		// Update more info
		request(PIGPV,0,0,0,(err,res)=> {
			info.pigpioVersion = res;
			
			request(HWVER,0,0,0, (err,version)=> {
				info.hwVersion = version;
				if ( (version >= 2) && (version<=3) ) {
					info.hardware_type = 1;
					info.userGpioMask = 0x3e6cf93;
				}
				if ( (version>4) && (version<15) ) {
					info.hardware_type = 2;
					info.userGpioMask = 0xfbc6cf9c;  // default
				}
				if ( version>15) {
					info.hardware_type = 3;
					info.userGpioMask = 0xffffffc;
				}
				info.conn1 = true;
				that.emit('connected');
			});
		});
		

	});
	commandSocket.on('error', function(err) {
		that.emit('error', {type: "network error", error: err});
	});
	commandSocket.on('end', function() {
		console.log('pigpio end received');
	});
	commandSocket.on('close', function() {
		if (info.conn1) console.log('pigpio connection closed');
			else console.log('Couldn\'t connect to pigpio@'+info.host+':'+info.port);
	});

	var resBuf = new Buffer.allocUnsafe(0);  // see responseHandler()
	
	commandSocket.on('data', (chunk)=> {
	
		var responseHandler = ()=> {
			/*	Extract response parameter (along with extended params) from response buffer
			(resBuf), return response as array argument to queued callback function in
			'callbackQueue.'  p3 contains either error code (if negative) OR response OR
			length of extended parameters.  Decoding cmd tells us if p3 is extended type of
			command. Partial response is saved to be used in subsequent 'data' callbacks.
			If response buffer contains more than a single response, the remainder will
			either be saved or called recursively.   
			*/
			const resArrBuf = new Uint8Array(resBuf).buffer;  // creates an Array Buffer copy
			const cmd = new Uint32Array(resArrBuf, 0, 1);  // view of first 4 32bit params
			var extLen;  // length of extended response
			var res = [];
			var err = null;
			if (canNeverFailCmdSet.has(cmd[0])) {
				// case p3 is uint32, always 16 length
				var p3 = new Uint32Array(resArrBuf,12,1);
				extLen = 0;
				//res[0] = p3[0];
			} else {
				var p3 = new Int32Array(resArrBuf,12,1);
//debugger
				if (p3[0] > 0) {
					// is this extended response?
					if (extResCmdSet.has(cmd[0])) {
						extLen = p3[0]; // p3 is length of extension
						// is response buffer incomplete?
						if (resArrBuf.byteLength < (extLen + 16))
							return;  // wait for more data
						else {
							let uint8Arr = new Uint8Array(resArrBuf,16,extLen);
							for (let i = 0; i < extLen; i++)
								res[i] = uint8Arr[i];
						}
					} else { 
						//res[0] = p3[0]; // p3 is normal response param
						extLen = 0;
					}
				} else { // p3 is less than (error) or equal (normal) to zero
						extLen = 0;
						if (p3[0] < 0) {
							err = p3[0]; // param[3] contains error code (negative)
							if (that.emit('error', {type: 'pigpio', error: p3[0]}))
								console.log('Houston, we have a problem.');
						}
				}
			}
			resBuf = resBuf.slice(extLen + 16); // leave remainder for later processing
			// process the response callback
			var callback = callbackQueue.shift(); // FIXME: test for queue underflow
			if (typeof callback === 'function') callback(err,p3[0], ...res);
			// does response buffer contain another response (potentially)?
			if (resBuf.length >= 16) responseHandler(); // recurse
			// check requestQueue for more requests to send
			if (requestQueue.length > 0 && (info.pipelining || callbackQueue.length === 0)) {
				var req = requestQueue.shift();
				commandSocket.write(req.buffer);
				callbackQueue.push(req.callback);
				if (process.env.DEBUG) {
					let b = req.buffer.toJSON().data;
					console.log("deferred request=\n",...b);
				}
			}
			return;
		} // responseHandler
		
		resBuf = Buffer.concat([resBuf, chunk]);
		if (process.env.DEBUG) {
			let b = resBuf.toJSON().data;
			console.log("response=\n",...b);
		}
		if (resBuf.length >= 16) responseHandler();
	});
	
	// helper functions
	var request = (cmd, p1, p2, p3, cb, extArrBuf)=> {
		var bufSize = 16;
		if ( extReqCmdSet.has(cmd)) {
			assert.equal(extArrBuf.byteLength, p3, "incorrect p3 or array length");
			bufSize = 16 + extArrBuf.byteLength;
		}
		var buf = new Buffer.allocUnsafe(bufSize);
		buf.writeUInt32LE(cmd,0);
		buf.writeUInt32LE(p1,4);
		buf.writeUInt32LE(p2,8);
		buf.writeUInt32LE(p3,12);

		if (bufSize > 16) {
			var extUint8 = new Uint8Array(extArrBuf);
			for (let i=0; i<extArrBuf.byteLength; i++)
				buf[i+16] = extUint8[i];
		}

		// Queue request if request queue is no empty OR callback queue is not empty and pipelining disabled
		if (requestQueue.length>0 || (callbackQueue.length>0 && !info.pipelining))
			requestQueue.push({buffer:buf, callback:cb });
		else {
			commandSocket.write(buf);
			callbackQueue.push(cb);
			if (process.env.DEBUG) {
				let b = buf.toJSON().data;
				console.log("request=\n",...b);
			}
		}
	} // request()
	
	var pigpv = (callback)=> {
		request(PIGPV,0,0,0,callback);
	}
	
	var hwver = (callback)=> {
		request(HWVER,0,0,0,callback);
	}
	
// Notifications socket = ToDo: check for notification errors response (res[3])
	var handle;
	var notificationSocket;
commandSocket.once('connect', ()=> {
	notificationSocket = net.createConnection(info.port, info.host, ()=> {
		console.log('notifier socket connected on rpi host '+info.host);
		let noib = Buffer.from(new Uint32Array([NOIB,0,0,0]).buffer);
		notificationSocket.write(noib, ()=>{
			// connect listener once to get handle from NOIB request
			notificationSocket.once('data', (resBuf)=> {
				const res = new Uint32Array(resBuf);
				handle = res[3];
				console.log('opened notification socket with handle= '+handle);
				// connect listener that processes notification chunks
				var chunk = new Buffer.allocUnsafe(0);
				notificationSocket.on('data', function (chunklet) {
					// monitors all gpio bits and issues callback for all registered notifiers.
					//console.log('got chunk'+JSON.stringify(chunk));
					chunk = Buffer.concat([chunk,chunklet]);
					let remainder = chunk.length%12;
					
					for (let i=0; i<chunk.length-remainder; i+=12) {
						let seqno = chunk.readUInt16LE(i+0),
							flags = chunk.readUInt16LE(i+2),
							tick = chunk.readUInt32LE(i+4),
							level = chunk.readUInt32LE(i+8);
						if (flags === 0)
							for (let nob of notifiers.keys())
								nob.func(level, tick);
					}
					if (remainder) {
						console.log('getting fractional chunks');
						//save the chunk remainder
						chunk = chunk.slice(remainder-chunk.length);
						
					}
				});
			});
		});
	});

	
	notificationSocket.on('error', function(err) {
		that.emit('error', {type: "network error:", error: err});
	});
	notificationSocket.on('end', function() {
		console.log('pigpio notification end received');
	});
	notificationSocket.on('close', function() {
		if (info.conn1) console.log('pigpio notification closed');
			else console.log('Couldn\'t connect to pigpio@'+info.host+':'+info.port);
	});
});
	
	/*** Public Methods ***/
	
	that.request = request;
	
	const MAX_NOTIFICATIONS = 32;
	var nID = 0;
	var notifiers = new Set();
	var monitorBits = 0;
	that.startNotifications = function(bits, cb) {
		// Registers callbacks for this gpio
		var nob = {
			id: nID++,
			func: cb,
			bits: +bits,
		};
		notifiers.add(nob);
		if (notifiers.size > MAX_NOTIFICATIONS)
			console.log('Warning: The notification maximum has been exceeded');
		// Update monitor with bits
		monitorBits |= bits;
		// send 'notifiy begin' command
		let nb = Buffer.from(new Uint32Array([NB, handle, monitorBits, 0]).buffer);
		//console.log(notify_begin.toJSON());
		commandSocket.write(nb);
		
		//return the callback 'id'
		return nob.id;
	}
	that.pauseNotifications = function(cb) {
	// Caution:  This will pause for all gpio!
		let notify_pause = Buffer.from(new Uint32Array([NP, handle, 0, 0]).buffer);
		commandSocket.write(notify_pause, ()=>{
			if (typeof cb === 'function') cb();
		});
	}
	that.stopNotifications = function(id) {
		// Clear monitored bits and unregister callback
		for (let nob of notifiers.keys())
			if (nob.id === id) {
				monitorBits &= ~nob.bits; // mask gpio bits to stop notifications
				notifiers.delete(nob); // remove notifier object from set of notifiers
			}
		// Stop the notifications on pigpio hardware
		let nb = Buffer.from(new Uint32Array([NB, handle, monitorBits, 0]).buffer);
		commandSocket.write(nb);
	}
	that.closeNotifications = function() {
		let nc = Buffer.from(new Uint32Array([NC, handle, 0, 0]).buffer);
			commandSocket.write(nc, ()=>{
				if (typeof cb === 'function') cb();
				// Todo: close/end notification socket?
				//console.log('closing notification socket');
				//notificationSocket.end(); // close, destroy socket
			});
	}
	that.isUserGpio = function(gpio) {
		return ((1<<gpio) &  info.userGpioMask)? true : false;
	}
	that.getInfo = function () {
		return (`\connected pigpiod info:
\thost : ${info.host}
\tport : ${info.port}
\tpigpio version : ${info.pigpioVersion}
\tRPi CPU info : ${info.hwVersion}
\tRPi HW type : ${info.hardware_type}
\tUser GPIO : ${info.userGpioMask.toString(16)}
\tpipelining : ${info.pipelining}
\tcommand socket connected : ${info.conn1}
\tnotifications socket connected : ${info.conn2}`);
	}
	that.connected = function() { // for legacy
		return info.conn1;
	}
/*
	that.pigpv = function () { // get pigpio version
		return pigpioVersion;
	}
	that.hwver = function () { // get hardware version
		return hwVersion;
	}
*/
	that.getCurrentTick = function(cb) {
		that.request(TICK,0,0,0,cb);
	}
	that.readBank1 = function(cb) {
		that.request(BR1,0,0,0,cb);
	}
	that.destroy = function() {
		commandSocket.destroy();
		notificationSocket.destroy();
	}
	that.end = function() {
		// return all gpio to input mode with pull-up/down?
		// clear any waveforms?
		// other resets?
		commandSocket.end();
		notificationSocket.end();
	}

/*___________________________________________________________________________*/

that.gpio = function(gpio) {
	var _gpio = function(gpio) {
		
		var modeSet = function(gpio, mode, callback) {
			if (typeof gpio !== 'number' || typeof mode !== 'string') {
				throw {
					name:'TypeError',
					message:'pigpio.modeSet argument types are number and string'
				}
			} if ( !that.isUserGpio(gpio) ) {
				throw {
					name:'PigpioError',
					message:'pigpio.modeSet gpio argument is not user gpio'
				}
			}
			var m = /^outp?u?t?/.test(mode)? 1 : /^inp?u?t?/.test(mode)? 0 : undefined;
			if (m === undefined) {
				throw "pigpio.modeSet error: invalid mode string";
				return;
			}
			request(MODES,gpio,m,0,callback);
		}
		
		var pullUpDown = function(gpio, pud, callback) {
			if (typeof gpio !== 'number' || typeof pud !== 'number') {
				throw {
					name:'TypeError',
					message:'pigpio.pullUpDown argument is not a number'
				}
			} if ( !that.isUserGpio(gpio) ) {
				throw {
					name:'PigpioError',
					message:'pigpio.pullUpDown gpio argument is not user gpio'
				}
			}
			// Assume pigpio library handles range error on pud argument!
			request(PUD,gpio,pud,0,callback);
		}
/*
		const gpio = (pi.isUserGpio(spec.gpio))? spec.gpio : null;
		if (!gpio) throw({Error:'gpio is not a valid user pin'});
		if (spec.mode) modeSet(gpio, spec.mode);
		if (spec.pud) pullUpDown(gpio, spec.pud);
*/			
		var notifierID = null;

	// basic methods
		this.modeSet = function(...args) {modeSet(gpio, ...args)}
		this.pullUpDown = function(...args) {pullUpDown(gpio, ...args)}
		this.write = function(level, callback) {
			
			if ( (+level>=0) && (+level<=1) ) {
				request(WRITE,gpio,+level,0,callback);
			}
			else throw "pigpio.write error: bad gpio or level";
		}
		this.read = function(callback) {
			request(READ,gpio,0,0,callback);
		}
		this.modeGet = function(callback) {
			request(MODEG,gpio,0,0,callback);
		}
	// PWM
		this.analogWrite = function(dutyCycle, cb) {
			request(PWM,gpio,dutyCycle,0,cb);
		}
	// Notification methods
		this.notify = function (callback) {
			// only allow one notifier per gpio object
			if (notifierID !== null) {
				console.log('Warning: notifier already registered, ignored');
				return;
			}
			let oldLevels = that.readBank1;
			let gpioBitValue = 1<<gpio;
			notifierID = that.startNotifications(gpioBitValue,(levels, tick)=> {
				let changes = oldLevels ^ levels;
				oldLevels = levels;
				if (gpioBitValue & changes) {
					let level = (gpioBitValue&levels)>>gpio;
					callback(level,tick);
				}
			});
		}
		this.endNotify = function () {
			if (notifierID !== null) that.stopNotifications(notifierID);
			notifierID = null;
		}

	// Waveform generation methods
		this.waveClear = function(callback) {
			request(WVCLR,0,0,0,callback);
		}
		this.waveCreate = function(callback) {
			request(WVCRE,0,0,0,callback);
		}
		this.waveBusy = function(callback) {
			request(WVBSY,0,0,0,callback);
		}
		this.waveAddPulse = function(tripletArr, callback) {
			//test triplets is an array of arrays
			tripletArr.forEach( function(triplet) {
				assert.equal( (Object.prototype.toString.apply(triplet)),'[object Array]',"tripletArr not an array");
				assert.equal(triplet.length, 3, "triplet array length is not 3");
			});
			
			// use Typed Arrays
			var arrBuf = new ArrayBuffer(tripletArr.length*3*4);  // items are 3 x 32-bit values
			var uint32Triplet = new Uint32Array(arrBuf,0,tripletArr.length*3);  // 32-bit view of buffer
			let i = 0;
			tripletArr.forEach(function(triplet) {
				uint32Triplet[i+0] = triplet[0]<<gpio; // 'set' gpio (bit value)
				uint32Triplet[i+1] = triplet[1]<<gpio; // 'clear' gpio (bit value)
				uint32Triplet[i+2] = triplet[2];
				i = i + 3;
			});
			// ship it
			request(WVAG,0,0,arrBuf.byteLength,callback,arrBuf);
		}
		const LOOP_START = 0xff, LOOP_DELAY = 0x2ff, LOOP_REPEAT = 0x1ff;
		this.waveChainTx = function(widArray, options, callback) {
			assert.equal(typeof options.delay, 'number',"delay not a number");
			assert.equal(typeof options.repeat, 'number',"repeat not a number");
			assert.equal(Array.isArray(widArray),true,"argument must be an array");

			var arrBuf = new ArrayBuffer(widArray.length+10);
			var header = new Uint16Array(arrBuf,0,1);
			var wids = new Uint8Array(arrBuf,2,widArray.length);
		//fixme: tail will fail if widArray is odd length!	
			//var tail = new Uint16Array(arrBuf, 2+widArray.length, 4);
			var tail = new Uint8Array(arrBuf, 2+widArray.length, 8);
			
			// build view of packet to send
			header[0] = LOOP_START;
			for (let i=0; i<widArray.length; i++)
				wids[i] = widArray[i];
			tail[0] = LOOP_DELAY&0xff;
			tail[1] = LOOP_DELAY>>8;
			tail[2] = options.delay&0xff;
			tail[3] = options.delay>>8;
			tail[4] = LOOP_REPEAT&0xff;
			tail[5] = LOOP_REPEAT>>8;
			tail[6] = options.repeat&0xff;
			tail[7] = options.repeat>>8;
			request(WVCHA,0,0,arrBuf.byteLength,callback,arrBuf);
		}
	
	}//var gpio
	_gpio.prototype = that; // inheritance
	return new _gpio(gpio);
}//that.gpio constructor
	return that;
}//pigpio constructor
