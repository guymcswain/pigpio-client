/*  Bit-Bang I2C and BSC Slave Example 
 *
 *  Connect SDA jumper wire between pin 3 (gpio 2) and pin 12 (gpio 18).
 *  Connect SCL jumper wire between pin 5 (gpio 3) and pin 35 (gpio 19).
 */
const pi = require('../pigpio-client.js').pigpio(); // localhost:8888

const s = require('debug')('i2c_slave');
const m = require('debug')('i2c_master');

const ready = new Promise( (resolve, reject) => {
  pi.once('connected', resolve);
  pi.once('error', reject);
});

const I2C_Message = "Hello I2C,123456"; // BSC FIFO is 16 deep

ready.then(async (info) => {
  console.dir(info);

  /* BSC slave */

  // configure
  let rv = await pi.bscI2C(0x13);
  s('bsc rv = ', rv);
  let rv_s = rv.slice(1, 5);
  s('bsc status = ', rv_s);
  if (rv[0] > 5) s('bsc data = ', rv.slice(5).map(x=>String.fromCodePoint(x)).join(''));
  else s('bsc read fifo empty');

  pi.on('EVENT_BSC', async() => {
    let [count, ...data] = await pi.bscI2C(0x13);
    let bsc_stat = data.slice(0, 4);
    data = data.slice(4);
    if (count>5) {
      s('BSC Rx status = ', bsc_stat);
      s('BSC Rx data =', data.map(x=>String.fromCodePoint(x)).join(''));
    }

    // write data to the BSC Tx FIFO
    if (data.length) {
      [count, ...bsc_stat] = await pi.bscI2C(0x13, data);
      s('BSC Tx status: ', bsc_stat);
    }
  });

  /* master */

  let i2c = await pi.bbI2cOpen(2, 3, 50000);
  let buf = I2C_Message;
  m('Sending: ', buf);
  await i2c.write(0x13, buf);

  // wait BSC to receive then echo the message
  // (Alternatively, you could use a gpio to notify the master.)
  await new Promise( (resolve, reject) => setTimeout(resolve, 1000) );

  // read the BSC data and convert to string
  let [count, ...data] = await i2c.read(0x13, I2C_Message.length);
  m(`reading ${count} bytes: `)
  m('message = ', data.map(x=> String.fromCodePoint(x)).join(''));


  await pi.bscI2C(0); // reset BSC peripheral
  i2c.close(e => { // call API with callback
    pi.end();
  });

}).catch(console.error);




