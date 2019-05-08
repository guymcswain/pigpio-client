// Supported command APIs
const CMDS = {
  MODES:  0,  // modeSet
  MODEG:  1,  // modeGet
  PUD:    2,  // pullUpDown
  READ:   3,  // read
  WRITE:  4,  // write
  PWM:    5,  // analogWrite, setPWMdutyCycle
  PFS:    7,  // setPWMfrequency
  BR1:    10, // bankRead1
  BR2:    11, // (internal)
  TICK:   16, // getCurrentTick
  HWVER:  17, // hwver
  NB:     19, // startNotifications, stopNotifications, notify
  NP:     20, // pauseNotifications
  NC:     21, // closeNotifications, end?
  PIGPV:  26, // pigpv
  WVCLR:  27, // waveClear
  WVAG:   28, // waveAddPulse
  WVAS:   29, // waveAddSerial
  WVBSY:  32, // waveBusy, waveNotBusy
  SLRO:   42, // serialReadOpen
  SLR:    43, // serialRead
  SLRC:   44, // serialReadClose
  WVCRE:  49, // waveCreate
  WVDEL:  50, // waveDelete
  GDC:    83, // getPWMdutyCycle
  HC:     85, // hwClock
  HP:     86, // hwPWM
  WVCHA:  93, // waveChainTx
  SLRI:   94, // serialReadInvert
  FG:     97, // glitch filter
  NOIB:   99, // (internal - notify open in-band)
  WVTXM: 100, // waveSendSync + PI_WAVE_MODE_ONE_SHOT_SYNC,
              // waveSendOnce + PI_WAVE_MODE_ONE_SHOT
  WVTAT: 101, // waveTxAt
}
exports.Commands = CMDS

var apiNames = {}
Object.entries(CMDS).forEach( ([key, val]) => {
  apiNames[val] = key
})
exports.APInames = apiNames

/* pigpio constants */
exports.Constants = {
  PUD_OFF: 0,
  PUD_DOWN: 1,
  PUD_UP: 2,
  PI_WAVE_MODE_ONE_SHOT: 0,
  PI_WAVE_MODE_REPEAT: 1,
  PI_WAVE_MODE_ONE_SHOT_SYNC: 2,
  PI_WAVE_MODE_REPEAT_SYNC: 3
}

/* Error messages */
exports.PigpioErrors = {
'-1': {message: 'gpioInitialise failed', code: 'PI_INIT_FAILED'},
'-2': {message: 'GPIO not 0-31', code: 'PI_BAD_USER_GPIO'},
'-3': {message: 'GPIO not 0-53', code: 'PI_BAD_GPIO'},
'-4': {message: 'mode not 0-7', code: 'PI_BAD_MODE'},
'-5': {message: 'level not 0-1', code: 'PI_BAD_LEVEL'},
'-6': {message: 'pud not 0-2', code: 'PI_BAD_PUD'},
'-7': {message: 'pulsewidth not 0 or 500-2500', code: 'PI_BAD_PULSEWIDTH'},
'-8': {message: 'dutycycle outside set range', code: 'PI_BAD_DUTYCYCLE'},
'-9': {message: 'timer not 0-9', code: 'PI_BAD_TIMER'},
'-10': {message: 'ms not 10-60000', code: 'PI_BAD_MS'},
'-11': {message: 'timetype not 0-1', code: 'PI_BAD_TIMETYPE'},
'-12': {message: 'seconds < 0', code: 'PI_BAD_SECONDS'},
'-13': {message: 'micros not 0-999999', code: 'PI_BAD_MICROS'},
'-14': {message: 'gpioSetTimerFunc failed', code: 'PI_TIMER_FAILED'},
'-15': {message: 'timeout not 0-60000', code: 'PI_BAD_WDOG_TIMEOUT'},
'-16': {message: 'DEPRECATED', code: 'PI_NO_ALERT_FUNC'},
'-17': {message: 'clock peripheral not 0-1', code: 'PI_BAD_CLK_PERIPH'},
'-18': {message: 'DEPRECATED', code: 'PI_BAD_CLK_SOURCE'},
'-19': {message: 'clock micros not 1, 2, 4, 5, 8, or 10', code: 'PI_BAD_CLK_MICROS'},
'-20': {message: 'buf millis not 100-10000', code: 'PI_BAD_BUF_MILLIS'},
'-21': {message: 'dutycycle range not 25-40000', code: 'PI_BAD_DUTYRANGE'},
'-21': {message: 'DEPRECATED (use PI_BAD_DUTYRANGE)', code: 'PI_BAD_DUTY_RANGE'},
'-22': {message: 'signum not 0-63', code: 'PI_BAD_SIGNUM'},
'-23': {message: "can't open pathname", code: 'PI_BAD_PATHNAME'},
'-24': {message: 'no handle available', code: 'PI_NO_HANDLE'},
'-25': {message: 'unknown handle', code: 'PI_BAD_HANDLE'},
'-26': {message: 'ifFlags > 3', code: 'PI_BAD_IF_FLAGS'},
'-27': {message: 'DMA channel not 0-14', code: 'PI_BAD_CHANNEL'},
'-27': {message: 'DMA primary channel not 0-14', code: 'PI_BAD_PRIM_CHANNEL'},
'-28': {message: 'socket port not 1024-32000', code: 'PI_BAD_SOCKET_PORT'},
'-29': {message: 'unrecognized fifo command', code: 'PI_BAD_FIFO_COMMAND'},
'-30': {message: 'DMA secondary channel not 0-6', code: 'PI_BAD_SECO_CHANNEL'},
'-31': {message: 'function called before gpioInitialise', code: 'PI_NOT_INITIALISED'},
'-32': {message: 'function called after gpioInitialise', code: 'PI_INITIALISED'},
'-33': {message: 'waveform mode not 0-3', code: 'PI_BAD_WAVE_MODE'},
'-34': {message: 'bad parameter in gpioCfgInternals call', code: 'PI_BAD_CFG_INTERNAL'},
'-35': {message: 'baud rate not 50-250K(RX)/50-1M(TX)', code: 'PI_BAD_WAVE_BAUD'},
'-36': {message: 'waveform has too many pulses', code: 'PI_TOO_MANY_PULSES'},
'-37': {message: 'waveform has too many chars', code: 'PI_TOO_MANY_CHARS'},
'-38': {message: 'no bit bang serial read on GPIO', code: 'PI_NOT_SERIAL_GPIO'},
'-39': {message: 'bad (null) serial structure parameter', code: 'PI_BAD_SERIAL_STRUC'},
'-40': {message: 'bad (null) serial buf parameter', code: 'PI_BAD_SERIAL_BUF'},
'-41': {message: 'GPIO operation not permitted', code: 'PI_NOT_PERMITTED'},
'-42': {message: 'one or more GPIO not permitted', code: 'PI_SOME_PERMITTED'},
'-43': {message: 'bad WVSC subcommand', code: 'PI_BAD_WVSC_COMMND'},
'-44': {message: 'bad WVSM subcommand', code: 'PI_BAD_WVSM_COMMND'},
'-45': {message: 'bad WVSP subcommand', code: 'PI_BAD_WVSP_COMMND'},
'-46': {message: 'trigger pulse length not 1-100', code: 'PI_BAD_PULSELEN'},
'-47': {message: 'invalid script', code: 'PI_BAD_SCRIPT'},
'-48': {message: 'unknown script id', code: 'PI_BAD_SCRIPT_ID'},
'-49': {message: 'add serial data offset > 30 minutes', code: 'PI_BAD_SER_OFFSET'},
'-50': {message: 'GPIO already in use', code: 'PI_GPIO_IN_USE'},
'-51': {message: 'must read at least a byte at a time', code: 'PI_BAD_SERIAL_COUNT'},
'-52': {message: 'script parameter id not 0-9', code: 'PI_BAD_PARAM_NUM'},
'-53': {message: 'script has duplicate tag', code: 'PI_DUP_TAG'},
'-54': {message: 'script has too many tags', code: 'PI_TOO_MANY_TAGS'},
'-55': {message: 'illegal script command', code: 'PI_BAD_SCRIPT_CMD'},
'-56': {message: 'script variable id not 0-149', code: 'PI_BAD_VAR_NUM'},
'-57': {message: 'no more room for scripts', code: 'PI_NO_SCRIPT_ROOM'},
'-58': {message: "can't allocate temporary memory", code: 'PI_NO_MEMORY'},
'-59': {message: 'socket read failed', code: 'PI_SOCK_READ_FAILED'},
'-60': {message: 'socket write failed', code: 'PI_SOCK_WRIT_FAILED'},
'-61': {message: 'too many script parameters (> 10)', code: 'PI_TOO_MANY_PARAM'},
'-62': {message: 'DEPRECATED', code: 'PI_NOT_HALTED'},
'-62': {message: 'script initialising', code: 'PI_SCRIPT_NOT_READY'},
'-63': {message: 'script has unresolved tag', code: 'PI_BAD_TAG'},
'-64': {message: 'bad MICS delay (too large)', code: 'PI_BAD_MICS_DELAY'},
'-65': {message: 'bad MILS delay (too large)', code: 'PI_BAD_MILS_DELAY'},
'-66': {message: 'non existent wave id', code: 'PI_BAD_WAVE_ID'},
'-67': {message: 'No more CBs for waveform', code: 'PI_TOO_MANY_CBS'},
'-68': {message: 'No more OOL for waveform', code: 'PI_TOO_MANY_OOL'},
'-69': {message: 'attempt to create an empty waveform', code: 'PI_EMPTY_WAVEFORM'},
'-70': {message: 'no more waveforms', code: 'PI_NO_WAVEFORM_ID'},
'-71': {message: "can't open I2C device", code: 'PI_I2C_OPEN_FAILED'},
'-72': {message: "can't open serial device", code: 'PI_SER_OPEN_FAILED'},
'-73': {message: "can't open SPI device", code: 'PI_SPI_OPEN_FAILED'},
'-74': {message: 'bad I2C bus', code: 'PI_BAD_I2C_BUS'},
'-75': {message: 'bad I2C address', code: 'PI_BAD_I2C_ADDR'},
'-76': {message: 'bad SPI channel', code: 'PI_BAD_SPI_CHANNEL'},
'-77': {message: 'bad i2c/spi/ser open flags', code: 'PI_BAD_FLAGS'},
'-78': {message: 'bad SPI speed', code: 'PI_BAD_SPI_SPEED'},
'-79': {message: 'bad serial device name', code: 'PI_BAD_SER_DEVICE'},
'-80': {message: 'bad serial baud rate', code: 'PI_BAD_SER_SPEED'},
'-81': {message: 'bad i2c/spi/ser parameter', code: 'PI_BAD_PARAM'},
'-82': {message: 'i2c write failed', code: 'PI_I2C_WRITE_FAILED'},
'-83': {message: 'i2c read failed', code: 'PI_I2C_READ_FAILED'},
'-84': {message: 'bad SPI count', code: 'PI_BAD_SPI_COUNT'},
'-85': {message: 'ser write failed', code: 'PI_SER_WRITE_FAILED'},
'-86': {message: 'ser read failed', code: 'PI_SER_READ_FAILED'},
'-87': {message: 'ser read no data available', code: 'PI_SER_READ_NO_DATA'},
'-88': {message: 'unknown command', code: 'PI_UNKNOWN_COMMAND'},
'-89': {message: 'spi xfer/read/write failed', code: 'PI_SPI_XFER_FAILED'},
'-90': {message: 'bad (NULL) pointer', code: 'PI_BAD_POINTER'},
'-91': {message: 'no auxiliary SPI on Pi A or B', code: 'PI_NO_AUX_SPI'},
'-92': {message: 'GPIO is not in use for PWM', code: 'PI_NOT_PWM_GPIO'},
'-93': {message: 'GPIO is not in use for servo pulses', code: 'PI_NOT_SERVO_GPIO'},
'-94': {message: 'GPIO has no hardware clock', code: 'PI_NOT_HCLK_GPIO'},
'-95': {message: 'GPIO has no hardware PWM', code: 'PI_NOT_HPWM_GPIO'},
'-96': {message: 'hardware PWM frequency not 1-125M', code: 'PI_BAD_HPWM_FREQ'},
'-97': {message: 'hardware PWM dutycycle not 0-1M', code: 'PI_BAD_HPWM_DUTY'},
'-98': {message: 'hardware clock frequency not 4689-250M', code: 'PI_BAD_HCLK_FREQ'},
'-99': {message: 'need password to use hardware clock 1', code: 'PI_BAD_HCLK_PASS'},
'-100': {message: 'illegal, PWM in use for main clock', code: 'PI_HPWM_ILLEGAL'},
'-101': {message: 'serial data bits not 1-32', code: 'PI_BAD_DATABITS'},
'-102': {message: 'serial (half) stop bits not 2-8', code: 'PI_BAD_STOPBITS'},
'-103': {message: 'socket/pipe message too big', code: 'PI_MSG_TOOBIG'},
'-104': {message: 'bad memory allocation mode', code: 'PI_BAD_MALLOC_MODE'},
'-105': {message: 'too many I2C transaction segments', code: 'PI_TOO_MANY_SEGS'},
'-106': {message: 'an I2C transaction segment failed', code: 'PI_BAD_I2C_SEG'},
'-107': {message: 'SMBus command not supported by driver', code: 'PI_BAD_SMBUS_CMD'},
'-108': {message: 'no bit bang I2C in progress on GPIO', code: 'PI_NOT_I2C_GPIO'},
'-109': {message: 'bad I2C write length', code: 'PI_BAD_I2C_WLEN'},
'-110': {message: 'bad I2C read length', code: 'PI_BAD_I2C_RLEN'},
'-111': {message: 'bad I2C command', code: 'PI_BAD_I2C_CMD'},
'-112': {message: 'bad I2C baud rate, not 50-500k', code: 'PI_BAD_I2C_BAUD'},
'-113': {message: 'bad chain loop count', code: 'PI_CHAIN_LOOP_CNT'},
'-114': {message: 'empty chain loop', code: 'PI_BAD_CHAIN_LOOP'},
'-115': {message: 'too many chain counters', code: 'PI_CHAIN_COUNTER'},
'-116': {message: 'bad chain command', code: 'PI_BAD_CHAIN_CMD'},
'-117': {message: 'bad chain delay micros', code: 'PI_BAD_CHAIN_DELAY'},
'-118': {message: 'chain counters nested too deeply', code: 'PI_CHAIN_NESTING'},
'-119': {message: 'chain is too long', code: 'PI_CHAIN_TOO_BIG'},
'-120': {message: 'deprecated function removed', code: 'PI_DEPRECATED'},
'-121': {message: 'bit bang serial invert not 0 or 1', code: 'PI_BAD_SER_INVERT'},
'-122': {message: 'bad ISR edge value, not 0-2', code: 'PI_BAD_EDGE'},
'-123': {message: 'bad ISR initialisation', code: 'PI_BAD_ISR_INIT'},
'-124': {message: 'loop forever must be last command', code: 'PI_BAD_FOREVER'},
'-125': {message: 'bad filter parameter', code: 'PI_BAD_FILTER'},
'-126': {message: 'bad pad number', code: 'PI_BAD_PAD'},
'-127': {message: 'bad pad drive strength', code: 'PI_BAD_STRENGTH'},
'-128': {message: 'file open failed', code: 'PI_FIL_OPEN_FAILED'},
'-129': {message: 'bad file mode', code: 'PI_BAD_FILE_MODE'},
'-130': {message: 'bad file flag', code: 'PI_BAD_FILE_FLAG'},
'-131': {message: 'bad file read', code: 'PI_BAD_FILE_READ'},
'-132': {message: 'bad file write', code: 'PI_BAD_FILE_WRITE'},
'-133': {message: 'file not open for read', code: 'PI_FILE_NOT_ROPEN'},
'-134': {message: 'file not open for write', code: 'PI_FILE_NOT_WOPEN'},
'-135': {message: 'bad file seek', code: 'PI_BAD_FILE_SEEK'},
'-136': {message: 'no files match pattern', code: 'PI_NO_FILE_MATCH'},
'-137': {message: 'no permission to access file', code: 'PI_NO_FILE_ACCESS'},
'-138': {message: 'file is a directory', code: 'PI_FILE_IS_A_DIR'},
'-139': {message: 'bad shell return status', code: 'PI_BAD_SHELL_STATUS'},
'-140': {message: 'bad script name', code: 'PI_BAD_SCRIPT_NAME'},
'-141': {message: 'bad SPI baud rate, not 50-500k', code: 'PI_BAD_SPI_BAUD'},
'-142': {message: 'no bit bang SPI in progress on GPIO', code: 'PI_NOT_SPI_GPIO'},
'-143': {message: 'bad event id', code: 'PI_BAD_EVENT_ID'},
'-2000': 'PI_PIGIF_ERR_0',
'-2099': 'PI_PIGIF_ERR_99',
'-3000': 'PI_CUSTOM_ERR_0',
'-3999': 'PI_CUSTOM_ERR_999'
}

