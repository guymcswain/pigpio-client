const pigpio = require('../pigpio-client').pigpio({host: "192.168.1.238"});  

console.log('starting');

// Add a function/device to a pigpio instance.
// then call like
// let enc1 = pigpio.encoder(gpia, gpib, opts?, (posn, inc, dur, tick)=>{});
// posn is shaft posn.  
// inc is direction of last move. 
// dur is time since last move in us. 
// tick is time of this move.
//
// callback will be called every time the position of the shaft encoder changes.
// optional opts to set the options:
// { glitch: 1000, mode:0, min:undefined, max: undefined, wrap: false }
// mode 0 -> every step.
// mode 1 -> step/4.
// glitch in microseconds
// min - min value
// max - max value
// wrap - if true, if posn < min then make it max.  if posn > max, then make it min
// e.g. if you want 10 values 0-9, min=0, max = 9, for 19 values -9 to 9, min=-9, max=9
//
// enc1.reset(step?); - resets shaft posion to zero or number

function addEncoder(pigpio_instance){
  pigpio_instance.encoder = async function(a, b, opts, cb) {
    /*

                 +---------+         +---------+      0
                 |         |         |         |
       A         |         |         |         |
                 |         |         |         |
       +---------+         +---------+         +----- 1

           +---------+         +---------+            0
           |         |         |         |
       B   |         |         |         |
           |         |         |         |
       ----+         +---------+         +---------+  1

    */
    if (typeof opts === 'function'){
      cb = opts;
      opts = null;
    }
    
    opts = opts || {};
    let defaultopts = {
      glitch: 1000,
      mode: 0,
      min: undefined,
      max: undefined,
      wrap: false,
    };
    
    let vals = Object.assign({}, defaultopts, opts);

    const PI_TIMEOUT = 2;
    const RED_MODE_DETENT = 1;
    const transits = [
      /* 0000 0001 0010 0011 0100 0101 0110 0111 */
          0,  -1,   1,   0,   1,   0,   0,  -1,
      /* 1000 1001 1010 1011 1100 1101 1110 1111 */
         -1,   0,   0,   1,   0,   1,  -1,   0
    ];
    
    let encoder = {
      
      data: {
        gpioA: a,
        gpioB: b,
        
        cb: cb, // callback

        levA: 0,
        levB: 0,

        oldState: 0,

        glitch: vals.glitch,
        mode: vals.mode,
        step: 0,
        
        div: 1,
        
        min: vals.min,
        max: vals.max,
        wrap: vals.wrap,
        
        lasttick:0,

      },
        
      reset: function(step){
        step = step || 0;
        step = (step * this.data.div) >> 0;
        this.data.step = step;
      },

      // called for each GPI independently
      notify: function(type, level, tick){
        let detent = -1;
        let newposn = -1;
        let inc = 0;
        if (level != PI_TIMEOUT){
          if (type === 0)
            this.data.levA = level;
          else
            this.data.levB = level;
          let newState = this.data.levA << 1 | this.data.levB;
          inc = transits[this.data.oldState << 2 | newState];
          if (inc) {
            this.data.oldState = newState;
            detent = (this.data.step / this.data.div)>>0;
            this.data.step += inc;
            newposn = (this.data.step / this.data.div)>>0;
          } 
        }

        // handle min/max/wrap
        if ((this.data.min !== undefined) ||
            (this.data.max !== undefined)){
          if (this.data.min !== undefined && newposn < this.data.min){
            let newval = this.data.min * this.data.div;
            if (this.data.wrap && this.data.max !== undefined){
              newval = (this.data.max * this.data.div) - 1;
            }
            this.data.step = newval;
            newposn = (this.data.step / this.data.div)>>0;
          }
          if (this.data.max !== undefined && newposn >= this.data.max){
            let newval = this.data.max * this.data.div;
            if (this.data.wrap && this.data.min !== undefined){
              newval = (this.data.min * this.data.div);
            }
            this.data.step = newval;
            newposn = (this.data.step / this.data.div)>>0;
          }
        }

        // note, we always call back if PI_TIMEOUT
        // and if not, there should always be a change?
        if (this.data.cb) {
          if (detent !== (this.data.step / this.data.div)>>0) {
            if (this.data.cb){
              this.data.cb((this.data.step / this.data.div)>>0, inc, tick - this.data.lasttick, tick);
            }
          }
        }
        this.data.lasttick = tick;
      },
      pigpio: pigpio_instance,
    };
    
    
    if (encoder.data.mode === RED_MODE_DETENT) {
      encoder.data.div = 4;
    }
    
    // get events from a button on GPIO 17
    const clk = this.gpio(encoder.data.gpioA);
    const dt = this.gpio(encoder.data.gpioB);
    await clk.modeSet('input');
    await dt.modeSet('input');  
    await clk.glitchSet(encoder.data.glitch);
    await dt.glitchSet(encoder.data.glitch);

    clk.notify((level, tick)=> {
      encoder.notify(0, level, tick);
    });
    dt.notify((level, tick)=> {
      encoder.notify(1, level, tick);
    });
    
    return encoder;
  };
};


addEncoder(pigpio);

const ready = new Promise((resolve, reject) => {
  pigpio.once('connected', resolve);
  pigpio.once('error', reject);
});


ready
.then(async (info) => {
  // display information on pigpio and connection status
  //console.log(JSON.stringify(info,null,2));
  console.log('ready');

  let len_m = (64/1000)/4;

  let opts = { min:-3, max:5, wrap:true };
  //opts = {};
  
  let enc1 = pigpio.encoder(10, 22, opts, (posn, inc, dur, tick)=>{
    let speed_m_s = 0;
    if (inc === -1)
      speed_m_s = -len_m/(dur/1000000);
    if (inc === 1)
      speed_m_s = len_m/(dur/1000000);
    console.log(`1: posn ${posn} dur ${dur} at ${tick} m/s:${speed_m_s}`);    
  });
  
  
  let enc2 = pigpio.encoder(9, 23, opts, (posn, inc, dur, tick)=>{
    let speed_m_s = 0;
    if (inc === -1)
      speed_m_s = -len_m/(dur/1000000);
    if (inc === 1)
      speed_m_s = len_m/(dur/1000000);
    console.log(`2: posn ${posn} dur ${dur} at ${tick} m/s:${speed_m_s}`);
  });
})
.catch((e)=>{
  console.error(e);
});
