// npm run-script usage
let host = '192.168.1.185' || process.env.npm_package_config_host;
const pigpio = require('../pigpio-client').pigpio({host: host});  

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
    addPCA9685Servos(pigpio);

    let servos = await pigpio.PCA9685Servos();

    // dump areas of the device that we can read
    await servos.dumpDevice(0, 70);
    await servos.dumpDevice(250, 6);

    // wiggle the second servo

  
    let s = {
        min: 0.0,
        max: 1.0,
        index:1
    };
    let servo_width = s.min;

    let loops = 0;
    let interval = setInterval(async ()=>{
        loops++;
        if (loops > 3){
            console.log('servotest ending');
            clearInterval(interval);
            // we should see the last values we set
            await servos.dumpDevice(0, 70);
            await servos.dumpDevice(250, 6);

            await servos.clearServos();  // stop all outputs
            await servos.close();  // stop all outputs
            console.log('servotest done');
            pigpio.end();
            return;
        }
    
        if (servo_width === s.min){
            servo_width = s.max;
        } else {
            servo_width = s.min;
        }
        
        //await servos.set_servo(servo_defn.camera, servo_width);
        await servos.set_servo(s.index, servo_width);

    }, 1000);  

});


function addPCA9685Servos(pigpio_instance){
    let pigpio = pigpio_instance;
    pigpio_instance.PCA9685Servos = async function(opts) {
        const DEFAULT_CYCLE_TIME_US	= 1000000/50 // default to 50Hz -> 20,000uS
        const DEFAULT_STEP_TIME_US	= 5 // gives 400 steps for typical servo range
        const DEFAULT_SERVO_MIN_US	= 500 // Be aware that many cheap servos get very annoyed
        const DEFAULT_SERVO_MAX_US	= 2500// by getting pushed too far. Use the min/max
        //const DEFAULT_SERVO_MIN_US	= 500 // Be aware that many cheap servos get very annoyed
        //const DEFAULT_SERVO_MAX_US	= 2500// by getting pushed too far. Use the min/max

        const MAX_SERVOS = 16;
        const I2C_BUS = 1;
        const DEFAULT_PCA_ADDR = 0x40;

        const MODE1 =0x00			//Mode  register  1
        const MODE2 =0x01			//Mode  register  2
        const SUBADR1 =0x02		//I2C-bus subaddress 1
        const SUBADR2 =0x03		//I2C-bus subaddress 2
        const SUBADR3 =0x04		//I2C-bus subaddress 3
        const ALLCALLADR =0x05     //LED All Call I2C-bus address
        const LED0 =0x6			//LED0 start register
        const LED0_ON_L =0x6		//LED0 output and brightness control byte 0
        const LED0_ON_H =0x7		//LED0 output and brightness control byte 1
        const LED0_OFF_L =0x8		//LED0 output and brightness control byte 2
        const LED0_OFF_H =0x9		//LED0 output and brightness control byte 3
        const LED_MULTIPLYER =4	// For the other 15 channels
        const ALLLED_ON_L =0xFA    //load all the LEDn_ON registers, byte 0 (turn 0-7 channels on)
        const ALLLED_ON_H =0xFB	//load all the LEDn_ON registers, byte 1 (turn 8-15 channels on)
        const ALLLED_OFF_L =0xFC	//load all the LEDn_OFF registers, byte 0 (turn 0-7 channels off)
        const ALLLED_OFF_H =0xFD	//load all the LEDn_OFF registers, byte 1 (turn 8-15 channels off)
        const PRE_SCALE =0xFE		//prescaler for output frequency
        const CLOCK_FREQ =25000000.0 //25MHz default osc clock
        const BUFFER_SIZE =0x08  //1 byte buffer
        // MODE1 reg flags
        const RESTART =0x80
        const EXTCLK =0x40
        const AI =0x20
        const SLEEP =0x10
        const NOTSLEEP =0x7F
        const SUB1 =0x8
        const SUB2 =0x4
        const SUB3 =0x2
        const ALLCALL =0x1
        // MODE2 reg flags
        const INVRT =0x10
        const OCH =0x8
        const OUTDRV =0x4
        //const OUTNE // doesn't matter here

        
        opts = opts || {};
        let defaultopts = {
            servo_max_us: DEFAULT_SERVO_MAX_US,
            servo_min_us: DEFAULT_SERVO_MIN_US,
            cycle_time_us: DEFAULT_CYCLE_TIME_US,
        };
        
        opts = Object.assign({}, opts, defaultopts);
        
        let PCA9685 = {
            
            pca: undefined,
            servowidth: [],
            servostartus: [],

            bus: I2C_BUS,
            i2c_address: DEFAULT_PCA_ADDR,
            
            cycle_time_us: 0,
            servo_max_us: DEFAULT_SERVO_MAX_US,
            servo_min_us: DEFAULT_SERVO_MIN_US,

            waitforme: function(millisec) {
                return new Promise(resolve => {
                    setTimeout(() => { resolve('') }, millisec);
                });
            },
        
            init: async function(){
                try {
        
                    // connect to the PCA9685 via i2c, quit if that fails
                    // Consider having the i2c address an argument when starting the daemon?
                    this.pca = await pigpio.i2cOpen(this.bus, this.i2c_address);

                    console.log('i2c handle: '+this.pca);
        
                    // initialise the PCA; write config byte to reg 0
                    // See PCA9685.pdf 7.3.1
                    // exactly what is best here is a bit arguable. I see 0x20 or 0x21 or 0 used variously
                    await pigpio.i2cWriteByteData(this.pca, MODE1, AI | ALLCALL);
        
                    // maybe we should set some flags in MODE2 as well?
                    // 0xC is used in at least one python based driver
                    await pigpio.i2cWriteByteData(this.pca, MODE2, /*OCH | */ OUTDRV);
                    // we have to wait for at least 500uS after setting the SLEEP flag to 0
                    await this.waitforme(10);
                    this.servo_max_us = opts.servo_max_us;
                    this.servo_min_us = opts.servo_min_us;
                    this.cycle_time_us = this.calculateTimerSettings(opts.cycle_time_us);
                    this.init_servo_starts();
                    await this.setPwmFreq();
                    // make all servos unpowered at start.
                    await this.clearServos();
                    
                    
                } catch(e){
                    console.error('i2c init error', e);
                }
            },

            dumpDevice: async function(start, len){
                // device has 256 registers, read in 32 byte chunks
                let deviceData = [];
                console.log('dump '+start +' for '+len);

                for (let i = start; i < start+len; i+= 32){
                    let l = (start+len) - i;
                    if (l > 32) l = 32;
                    let res = await pigpio.i2cReadI2cBlockData(this.pca, i, l);
                    console.log('bytes read: '+res[0]+' bytes:'+ res.toString());
                    res.shift();
                    deviceData.push(...res);
                }
                for (let i = 0; i < deviceData.length; i+= 16){
                    let addr = '0'+i.toString(16);
                    addr = addr.slice(-2);
                    let str = addr+': ';
                    let l = deviceData.length - i;
                    if (l > 16) l = 16;
                    for (let j = 0; j < l; j++){
                        let val = '0'+deviceData[i+j].toString(16);
                        val = val.slice(-2);
                        str += val+' ';
                    }
                    console.log(str);
                }
            },
            
            close: async function(){
                if (this.pca !== undefined){
                    await this.clearServos();
                    await this.setSleep(); // stop the clock
                    await pigpio.i2cClose(this.pca);
                    this.pca = undefined;
                }
            },
        
            init_servo_starts: function() {
                let us_per_servo = this.cycle_time_us/MAX_SERVOS;
                let curr_us = 10;
                
                /* set the servo start ticks to spread out the current draw */
                for (let servo = 0; servo < MAX_SERVOS; servo++) {
                    this.servowidth.push(0);
                    this.servostartus.push(0);
                    this.servostartus[servo] = curr_us;
                    if (this.servostartus[servo] + this.servo_max_us >= this.cycle_time_us){
                    curr_us = us_per_servo/3;
                    this.servostartus[servo] = curr_us;
                    }
                    curr_us += us_per_servo;
                }
            },
        
            calculateTimerSettings: function(cycle_time) {
                let freq = 1000000 / cycle_time;
                this.timer_prescale = (CLOCK_FREQ / 4096 / freq)  - 1;
                //console.log("Setting prescale value to: "+ timer_prescale);
                //console.log("Actual frequency: "+ (CLOCK_FREQ / 4096.0) / (timer_prescale + 1));
                // adjust the global cycle time to reflect reality
                let cycle_time_us = 1000000 * (this.timer_prescale +1)/ (CLOCK_FREQ / 4096.0);
                console.log("cycle time: "+ cycle_time_us+"ms");
                console.log("servo_min_us " +this.servo_min_us+" servo_max_us "+this.servo_max_us+
                    " travel "+(this.servo_max_us - this.servo_min_us)+"us");
                let steps = ((((this.servo_max_us - this.servo_min_us)/cycle_time_us)*4096)>>0);
                console.log("steps full travel "+ ((((this.servo_max_us - this.servo_min_us)/cycle_time_us)*4096)>>0));
                console.log("servo resolution ~"+(((10000/steps)>>0)/100)+"%");
                return cycle_time_us;
            },
        
            setPwmFreq: async function (){
                let oldmode = await pigpio.i2cReadByteData(this.pca, MODE1);
                let newmode = (oldmode & NOTSLEEP) | SLEEP;    //sleep
                await pigpio.i2cWriteByteData(this.pca, MODE1, newmode);        // go to sleep
                await pigpio.i2cWriteByteData(this.pca, PRE_SCALE, this.timer_prescale);
                await pigpio.i2cWriteByteData(this.pca, MODE1, oldmode);
                await this.waitforme(10);
                await pigpio.i2cWriteByteData(this.pca, MODE1, oldmode | RESTART);
            },
        
            setSleep: async function(){
                try{
                    let oldmode = await pigpio.i2cReadByteData(this.pca, MODE1);
                    let newmode = (oldmode & NOTSLEEP) | SLEEP;    //sleep
                    await pigpio.i2cWriteByteData(this.pca, MODE1, newmode);        // go to sleep
                } catch(e){
                    console.error(e);
                }
            },
            
            // could be done with a single block read?
            read_servo: async function (servo) {
                // illustrate use of i2cReadWordData
                let onw = await pigpio.i2cReadWordData(this.pca, LED0_ON_L + LED_MULTIPLYER * servo);
                let offw = await pigpio.i2cReadWordData(this.pca, LED0_OFF_L + LED_MULTIPLYER * servo);
                console.log({ onw, offw });

                // illustrate use of i2cReadI2cBlockData
                // note because await, we get an array back which starts with length
                let b = await pigpio.i2cReadI2cBlockData(this.pca, LED0_ON_L + LED_MULTIPLYER * servo, 4);
                let len = b[0];
                let on = b[1] | (b[2]<<8);
                let off = b[3] | (b[4] << 8);
                console.log({ on, off });

                return {on, off};
            },
        
        
            set_servo: async function(servo, width) {
                try {
                    if (width === -1){
                        // illustrate use of i2cWriteWordData to set on and off separately.
                        await pigpio.i2cWriteWordData(this.pca, LED0_ON_L + LED_MULTIPLYER * servo, 0);
                        await pigpio.i2cWriteWordData(this.pca, LED0_OFF_L + LED_MULTIPLYER * servo, 0);
                    } else {
                        this.servowidth[servo] = width;
                        //console.log( `set servo[${servo}]=${width*100}`);
                        // set this servo to start at the servostart tick and stay on for width ticks
                        let range = (this.servo_max_us - this.servo_min_us);
                        let val = this.servowidth[servo] * range;
                        let dur = this.servo_min_us + val;

                        let on_us = this.servostartus[servo];
                        let off_us = on_us + dur;
                        
                        let on_value = ((on_us/this.cycle_time_us)*4096)>>0;
                        let off_value = ((off_us/this.cycle_time_us)*4096)>>0;
                        
                        //console.log(`rangeus ${range} valus ${val} durus ${dur} offval ${off_value}`);
                        if (off_value > 4095) off_value = 4095;
                        on_value = on_value >> 0;
                        off_value = off_value >> 0;

                        let data = [on_value & 0xff,(on_value >>8) & 0xff, off_value & 0xff,(off_value >>8) & 0xff ];

                        // illustrate use of i2cWriteI2cBlockData to set all 4 regs at the same time.
                        await pigpio.i2cWriteI2cBlockData(this.pca, LED0_ON_L + LED_MULTIPLYER * servo, data);
                        
                        let res = await this.read_servo(servo);
                        let diff = (res.off - res.on)*this.cycle_time_us/4096;
                        let percent = (((((diff - this.servo_min_us) / range)*100)*10)>>0)/10;
                        console.log('read servo '+servo, res, ''+(diff>>0)+'us', percent+'%');
                    }
                    
                } catch (e){
                    console.log('read servo exception', e);
                }
            }, 
        
            clearServos: async function (){
                for (let i = 0; i < MAX_SERVOS; i++){
                    await this.set_servo(i, -1);
                }
            },
        
            allServos: async function (val){
                for (let i = 0; i < MAX_SERVOS; i++){
                    await this.set_servo(i, val);
                }
            },
        };


        console.log(PCA9685);
        
        await PCA9685.init();

        return PCA9685;
    };
}
