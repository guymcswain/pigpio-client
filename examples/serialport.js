/*
 * Serial Port example - Create a loop-back serial port then send and receive
 * a message.
 */
const pigpio = require('../pigpio-client.js').pigpio({host: '192.168.100.2'});
const promisify = require('util').promisify;

pigpio.once('connected', () => {
  
  const SP = pigpio.serialport(17, 17); // rx=tx for loopback
  const serialport = {
    write: SP.write,
    read: promisify(SP.read),
    open: promisify(SP.open),
    close: promisify(SP.close),
    end: promisify(SP.end)
  };
  
  (async () => {
    try {
      await serialport.open(38400, 8)
      serialport.write("Hello Serial Port")
      await sleep(100)
      let message = await serialport.read()
      console.log(message)
      await serialport.end()
      pigpio.end()
    }
    catch(e) { throw e }
  })()

})
  
function sleep(interval) {
  return new Promise(resolve => setTimeout(resolve, interval))
}