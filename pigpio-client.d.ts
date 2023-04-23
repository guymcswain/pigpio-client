declare module 'pigpio-client' {
    import EventEmitter from 'events';
    import { Socket } from 'net';

    export function pigpio(pi?: PigpioInitializationInterface): PigpioEventEmitter;

    export const Constants = {
        PUD_OFF: 0,
        PUD_DOWN: 1,
        PUD_UP: 2,
        PI_WAVE_MODE_ONE_SHOT: 0,
        PI_WAVE_MODE_REPEAT: 1,
        PI_WAVE_MODE_ONE_SHOT_SYNC: 2,
        PI_WAVE_MODE_REPEAT_SYNC: 3,
        PI_FILE_READ: 1,
        PI_FILE_WRITE: 2,
        PI_FILE_RW: 3,
        PI_FROM_START: 0,
        PI_FROM_CURRENT: 1,
        PI_FROM_END: 2,
    };

    interface PigpioInitializationInterface {
        host?: string;
        port?: number;
        pipelining?: boolean;
        timeout?: number;
    }

    class PigpioEventEmitter extends EventEmitter {
        request(
            cmd: number,
            p1: number,
            p2: number,
            p3: number,
            cb?: (err, ...args) => void,
            extArrBuf?: ArrayBuffer | SharedArrayBuffer,
        ): Promise | undefined;
        connect(): void;
        startNotifications(bits: number, cb: (levels: number | null, ticks: number | null) => void): null | number;
        pauseNotifications(cb?: (err, ...args) => void): Promise | undefined;
        stopNotifications(cb?: (err, ...args) => void): Promise | undefined;
        closeNotifications(cb?: (err, ...args) => void): Promise | undefined;
        getInfo(): InfoInterface;
        getHandle(): number;
        getCurrentTick(cb?: (err, ...args) => void): Promise | undefined;
        readBank1(cb?: (err, ...args) => void): Promise | undefined;
        hwClock(gpio: number, freq: number, cb?: (err, ...args) => void): Promise | undefined;
        destroy(): void;
        end(cb?: () => void);
        gpio(gpio: number): PigpioGpio;
        serialport(rx: number, tx: number, dtr?: number): PigpioSerialPort;
        spi(channel: number): PigpioSpi;
        file(): PigpioFile;
        i2c(bus: number, address: number): PigpioI2c;
    }

    interface InfoInterface {
        host: string;
        port: number;
        pipelining: boolean;
        commandSocket: undefined | Socket; // connection status undefined until 1st connect
        notificationSocket: undefined | Socket; // connection status undefined until 1st connect
        pigpioVersion: string;
        hwVersion: string;
        hardware_type: number; // 2 = 26 pin plus 8 pin connectors (ie rpi model B)
        userGpioMask: number; // 0xfbc6cf9c
        timeout: number; // Default is back compatible with v1.0.3. Change to 5 in next ver.
        version: string;
    }

    class PigpioGpio extends PigpioEventEmitter {
        modeSet(gpio: number, mode: 'output' | 'input', callback?: (err, ...args) => void): void;
        pullUpDown(gpio: number, pud: number, callback?: (err, ...args) => void): void;
        write(level: 0 | 1, callback?: (err, ...args) => void): Promise | undefined;
        read(callback?: (err, ...args) => void): Promise | undefined;
        modeGet(callback?: (err, ...args) => void): Promise | undefined;
        analogWrite(dutyCycle: number, cb?: (err, ...args) => void): Promise | undefined;
        notify(callback: (level: number | null, tick: number | null) => void): undefined;
        endNotify(cb?: (err, res) => void): void;
        glitchSet(steady: number, callback?: (err, ...args) => void): Promise | undefined;
        waveClear(callback?: (err, ...args) => void): Promise | undefined;
        waveCreate(callback?: (err, ...args) => void): Promise | undefined;
        waveBusy(callback?: (err, ...args) => void): Promise | undefined;
        waveNotBusy(time?: number | function, callback?: (err, ...args) => void): Promise;
        waveAddPulse(tripletArr: number[3], callback?: (err, ...args) => void): Promise | undefined;
        waveChainTx(
            paramArray: { loop?: boolean; repeat?: boolean | number; delay?: number; waves?: number[] }[],
            callback?: (err, ...args) => void,
        ): Promise | undefined;
        waveTxStop(callback?: (err, ...args) => void): Promise | undefined;
        waveSendSync(wid: number, cb?: (err, ...args) => void): Promise | undefined;
        waveSendOnce(wid: number, cb?: (err, ...args) => void): Promise | undefined;
        waveTxAt(cb?: (err, ...args) => void): Promise | undefined;
        waveDelete(wid: number, cb?: (err, ...args) => void): Promise | undefined;
        setPWMdutyCycle(dutyCycle: number, cb?: (err, ...args) => void): Promise | undefined;
        setPWMfrequency(freq: number, cb?: (err, ...args) => void): Promise | undefined;
        getPWMdutyCycle(cb?: (err, ...args) => void): Promise | undefined;
        hardwarePWM(frequency: number, dutyCycle: number, callback?: (err, ...args) => void): Promise | undefined;
        setServoPulsewidth(pulseWidth: number, cb?: (err, ...args) => void): Promise | undefined;
        getServoPulsewidth(cb?: (err, ...args) => void): Promise | undefined;
        serialReadOpen(baudRate: number, dataBits: number, callback?: (err, ...args) => void): Promise | undefined;
        serialRead(count: number, callback?: (err, ...args) => void): Promise | undefined;
        serialReadClose(callback?: (err, ...args) => void): Promise | undefined;
        serialReadInvert(mode: 'invert' | 'normal', callback?: (err, ...args) => void): Promise | undefined;
        waveAddSerial(
            baud: number,
            bits: number,
            delay: number,
            data: ArrayBuffer | SharedArrayBuffer,
            callback?: (err, ...args) => void,
        ): Promise | undefined;
    }
    class PigpioSerialPort extends PigpioEventEmitter {
        open(baudrate, databits, cb?: (err, res: boolean) => void): void;
        read(size: number | function, cb?: (err, res: undefined | null | string) => void): void;
        write(data: string): number;
        close(callback?: (err, res: number | undefined) => void): void;
        end(callback?: (err?) => void): void;
    }
    class PigpioSpi extends PigpioEventEmitter {
        open(baud: number, spiFlags: number): Promise;
        close(callback?: (err, ...args) => void): Promise | undefined;
        write(data: Uint8Array, callback?: (err, ...args) => void): Promise | undefined;
    }
    class PigpioFile extends PigpioEventEmitter {
        open(remoteFileName: string, mode: number): Promise;
        close(callback?: (err, ...args) => void): Promise | undefined;
        read(count: number): Promise;
        seek(offset: number, from: number, callback?: (err, ...args) => void): Promise | undefined;
    }
    class PigpioI2c extends PigpioEventEmitter {
        open(i2cFlags: number): Promise;
        close(callback?: (err, ...args) => void): Promise | undefined;
        read(count: number): Promise;
        write(data: Uint8Array, callback?: (err, ...args) => void): Promise | undefined;
        readByte(register: number, callback?: (err, ...args) => void): Promise | undefined;
        readBlock(register: number, count: number): Promise;
    }
}
