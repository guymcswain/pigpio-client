# pigpio-client
Control a Raspberry **Pi**'s **g**eneral **p**urpose **i**nput and **o**utput pins over a network socket using Javascript and the NodeJS runtime.

## What kind of wizardry is this  
Daemons.  Specifically *pigpio daemons (pigpiod)* running on Raspberry Pi<sup>TM</sup> connected to your local area network.  Once *pigpiod* is installed on the target, your script, running on another host, uses the *pigpio-client* module to connect to the *pigpiod* and expose the *socket interface* (application programming interface) of the *pigpio* library.

### Hardware controlled - software managed IO
The *pigpio* library controls timing of IO pins using hardware.  The configuration, initiation and monitoring is managed by the software API.  This architecture decouples the timing on the IO from the software application.  This is the magic!  It avoid the software timing control mess requiring kernel space drivers, real-time operating systems or, worse yet, bare-metal programming.  You just need a Raspberry Pi running Raspbian linux and the pigpiod service.  

Since your app doesn't need to be 'close to the metal', you can just as easily run it from the host of your choice on the same network.  In this way, you can deploy inexpensive Raspberry Pi Zero-W to control the IO while having a rather large and complex application to manage it.

## Inspired by pigpio Python module
Pigpio-client essentially provides the same features as the pigpio Python module to the NodeJS environment.  Notable exceptions are the lack of a 'english' error messages for exceptions and implementation of pigio 'scripting.'  Both of these features are pending for a future release of pigpio-client.

## Serial port
A unique feature of pigpio-client are serial port objects that can be created with arbitrary GPIO pins.  Originally conceived to program an Arduino from the RPi, it implements RX, TX and DTR pins.  Try it!

## Install it
```bash
npm i pigpio-client
```
