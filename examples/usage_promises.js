// npm run-script usage
const pigpio = require('../pigpio-client').pigpio({host: process.env.npm_package_config_host});  

const ready = new Promise((resolve, reject) => {
  pigpio.once('connected', resolve);
  pigpio.once('error', reject);
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

ready.then(async (info) => {
  // display information on pigpio and connection status
  console.log(JSON.stringify(info,null,2));

  // get events from a button on GPIO 17
  const button = pigpio.gpio(17);
  await button.modeSet('input');
  button.notify((level, tick)=> {
    console.log(`Button changed to ${level} at ${tick} usec`)
  });

  // control an LED on GPIO 4
  const led = pigpio.gpio(4);
  await led.modeSet('output');
  await led.write(1);  // turn on LED
  await wait(500);
  await led.write(0);  // turn off
  await wait(500);

  // use waves to blink the LED rapidly (toggle every 100ms)
  await led.waveClear();
  await led.waveAddPulse([[1, 0, 100000], [0, 1, 100000]]);
  const blinkWave = await led.waveCreate();
  led.waveChainTx([{loop: true}, {waves: [blinkWave]}, {repeat: true}]);

  // wait for 10 seconds, stop the waves
  await wait(10000);
  await led.waveTxStop();
  pigpio.end();
}).catch(console.error);