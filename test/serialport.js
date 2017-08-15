'use strict';
const LoremIpsum = require('../../../.npm-global/lib/node_modules/lorem-ipsum')
var lorip = LoremIpsum()
console.log(lorip)
const PigpioClient = require('../pigpio-client');
//const pi = PigpioClient.pigpio({host:'10.0.0.56'});  // surveyor host
const pi = PigpioClient.pigpio({host:'10.0.0.105'});  // surveyor host (wireless)

pi.on('connected', (info)=> {
  if (typeof info !== 'undefined') {
    console.log(JSON.stringify(info,null,2))
    pi.request(35,2,0,0, (err, res)=> {
      console.log('max pulses = '+res)
    })
    runSerialPortTest()
  }
  else {
    setTimeout( () => {
      runSerialPortTest()
    }, 500)
  }
  
  function runSerialPortTest() {
    var serial = pi.serialport(5,5,6); // loopback: rx=tx
    if (serial !== undefined) console.log("Have serialport object!");
    var readTimer

    serial.open(38400, 8, (err)=> {
      if (err) console.log(err);
      else {
        console.log('serial port is open');
        
        // start read timer
        console.log('trying serial.read');
        readTimer = setInterval( ()=> {
          serial.read( (err,data)=> {
            if (err) {
              console.log("Error! "+err);
            }
            else if (data !== null) {
              console.log('read this many bytes: '+data.length)
              console.log('\t'+data);
            }
            
          });
        },100);
        
        // write
        console.log('trying serial.write');
        let toSend = Buffer.from("Hello, ");
        serial.write(toSend);
        toSend = Buffer.from("I love you, ");
        serial.write(toSend);
        serial.write("won't you tell me your name?")
        
        // wait, then write some more
        setTimeout( () => {
          let words = LoremIpsum({count:1000, units: 'words'})
          let chars = words.slice(0,600);
          console.log(`sending ${chars.length} characters`)
          let sent = serial.write(chars)
          console.log('sent char count = '+sent)
          chars = words.slice(600,1200)
          console.log(`sending ${chars.length} characters`)
          sent = serial.write(chars)
          console.log('sent char count = '+sent)
        }, 500)
        
      }
    });
    
    console.log('waiting for timeout');
    setTimeout(function() {
      clearInterval(readTimer)
      serial.close( ()=> {
        console.log('closed serial port');
        pi.end( () => {
          let info = pi.getInfo()
          console.log(info)
          pi.destroy(); 
          console.log("Goodbye");
        })
      });
    },5000);
  
  }//end runSerialPortTest()
  
});

pi.on('error', (err)=> {
	//throw err);
	console.log('!!!!! '+err.message);
});


/*
var pigpioClient = require('../pigpio-client');
	var myPi = pigpioClient.pigpio({host:'10.0.0.12',pipelining:false});
	myPi.on('connected', (info)=> {
		//console.log('connected rpi with info:');
		//console.log(info);
		//console.log('connect status:'+myPi.connected());
		let piInfo = myPi.getInfo();
		console.log(piInfo);
		
		var led = myPi.gpio(17);
		led.modeSet('output');
		led.write(0); // turn led off
		
		var ledIsOn = false;

		var timer = setInterval(function() {
			if (ledIsOn) {
				//myPi.write(17,0);
				led.write(0);
				console.log('led off');
				ledIsOn = false;
			}
			else {
				//myPi.write(17,1);
				led.write(1);
				console.log('led on');
				ledIsOn = true;
			}
		},500);


	});
*/		
