// npm run-script usage
//const pigpio = require('../pigpio-client').pigpio({host: process.env.npm_package_config_host});

const pigpio = require('../pigpio-client').pigpio({host: "192.168.1.238"});  

const ready = new Promise((resolve, reject) => {
  pigpio.once('connected', resolve);
  pigpio.once('error', reject);
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

ready.then(async (info) => {

  // control an analogue CV level on GPIO 
    const cv1 = pigpio.gpio(18);
    const cv2 = pigpio.gpio(19);
    
    var range = 1E6;
    var freq1 = 1E5;
    var freq2 = 2E5;
    var cv2offset = 2E5;
    
    await cv1.hardwarePWM(freq1, range/2);
    await wait(1000);
    await cv2.hardwarePWM(freq2, range/3);
    await wait(1000);
    

}).catch(console.error);
