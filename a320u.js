//"use strict";
//exports.__esModule = true;

var Tinkerforge = require("./node_modules/tinkerforge");
var extplanejs_1 = require("./node_modules/extplanejs");

var alti_mode = 1;
var altitude;

var HOST = 'localhost';
var PORT = 4223;
var UID_RotatoryEncoder = 'EpB';
var UID_7seg = 'wNQ';
var rotation_val = 0;

// 7 Segment Anzeiger 0~9,A,b,C,d,E,F,off(16)
var Digits = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71, 0x00];

var ipcon = new Tinkerforge.IPConnection();
var RotatoryEncoder = new Tinkerforge.BrickletRotaryEncoderV2(UID_RotatoryEncoder, ipcon);
var Segment7 = new Tinkerforge.BrickletSegmentDisplay4x7(UID_7seg, ipcon);


function set7Segment (value) {
    var segments = [Digits[16], Digits[16], Digits[16], Digits[16]];
    var value_array = value.toString(10).replace(/\D/g, '0').split('').map(Number);
    var counter = segments.length - value_array.length;

    for(var i = counter; i < 4; i++)
    {
        segments[i] = Digits[value_array[i-counter]];
    }
    return segments;
}



ipcon.connect(HOST, PORT, function (error) {
    console.log('Error: ' + error);
    return process.exit(0);
});

ipcon.on(Tinkerforge.IPConnection.CALLBACK_CONNECTED,
    function (connectReason) {
        // Set period for count callback to 1s (1000ms) without a threshold
        RotatoryEncoder.setCountCallbackConfiguration(100, true, 'x', 0, 0);
    }
);

var ExtPlane = new extplanejs_1({
    "host": "127.0.0.1",
    "port": 51000,
    "broadcast": false,
    "debug": true
});

ExtPlane.on('loaded', function () {
    this.client.subscribe('a320/Aircraft/FMGS/FCU1/Altitude');
    this.client.subscribe('a320/Panel/FCU_AltitudeStep');
});

RotatoryEncoder.on(Tinkerforge.BrickletRotaryEncoderV2.CALLBACK_COUNT,
    function (count) {
       var change = count - rotation_val;
       console.log("Change: " + change + ", Count: " + count + ", RotVal: " + rotation_val );
       new_altitude = altitude + change * alti_mode;
       if(alti_mode == 10)
       {
           new_altitude = Math.round(new_altitude / 10) * 10;
       }
       ExtPlane.client.set('a320/Aircraft/FMGS/FCU1/Altitude', new_altitude);
       console.log("New Altitude: " + new_altitude);
       rotation_val = count;
});

RotatoryEncoder.on(Tinkerforge.BrickletRotaryEncoderV2.CALLBACK_PRESSED,
    function () {
        if(alti_mode == 1)
        {
            alti_mode = 10;
            ExtPlane.client.set('a320/Panel/FCU_AltitudeStep', 1);
        } else {
            alti_mode = 1;
            ExtPlane.client.set('a320/Panel/FCU_AltitudeStep', 0);
        }
        console.log("Pressed");
});


ExtPlane.on('a320/Panel/FCU_AltitudeStep', function(data_ref, value){
    if(value) {
        alti_mode = 10;
        console.log("Altimeter Mode 1.000er");
    } else {
        alti_mode = 1;
        console.log("Altimeter Mode 100er");
    }
});

ExtPlane.on('a320/Aircraft/FMGS/FCU1/Altitude', function(data_ref, value){
    Segment7.setSegments(set7Segment(value),6,false);
    altitude = value;
    console.log("Altitude: " + value);
});


console.log('Press key to exit');
process.stdin.on('data',
    function (data) {
        //lcd.backlightOff();
        ipcon.disconnect();
        process.exit(0);
    }
);