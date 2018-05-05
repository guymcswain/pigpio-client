# pigpio-client
Control a Raspberry **Pi**'s **g**eneral **p**urpose **i**nput and **o**utput pins over a network socket using Javascript and the NodeJS runtime.

## How the wizardry works
It employs daemons.  Specifically *pigpiod* daemons running on Raspberry Pi<sup>TM</sup> connected to your local area network.  Once *pigpiod* is installed on the target, your script, running on a another host, uses the *pigpio-client* module to connect to the *pigpiod* and expose the *socket interface* (application programming interface) of the *pigpio* library.
