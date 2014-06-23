/**  This script is for the police bot wandering around Oulu 3D.
* @author Lasse Annola <lasseann@ee.oulu.fi>
*/


// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script

engine.ImportExtension('qt.core');
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");
SetLogChannelName("Police script");
Log("Script starting");

/** 
 * This script is for the police bot wandering around Oulu 3D.
 * @module PoliceScript 
*/

/**Variable for parsed Navigation Mesh. Includes x and z coordinates. 
 * @type Array */
var pathWays;

/** Holder for next destination of movement. Includes x and z coordinates. 
 * @type Array */
var nextDest;

/** Boolean to check if orientation was already set. 
 * @type bool */
var orientationSet = false;

/** Player that will be busted by the police. 
 * @type Object */
var playerToBeBusted;

/** Interval for Update function. 
 * @type int */
var interval = 0;

/** Current amount of visible polices on script start. 
 * @type List */
var visiblePolices = scene.EntitiesOfGroup('Polices');

/** Players that have been busted and their data was already sent to server, here to avoid duplicate posts to GameAnalytics. 
 * @type Array */
var bustedPlayers = [];

/** Boolean to check if Policebot reached movement goal. 
 * @type bool */
var reachedgoal = true;

/** Get the Navigation Mesh object for the script. Hosted at Meshmoon scene storage. */
var transfer = asset.RequestAsset("http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/navmesh/kartta.obj", "Binary", true);
transfer.Succeeded.connect(function(transfer) {
    pathWays = parseObjData(transfer);
});

frame.Updated.connect(Update);

/** 
 * Update function that is ran on every frame.
 * @param {int} frametime - Int to check how many frames are through.
 */
function Update (frametime) {
    if (!server.IsRunning()) {
        /** Monitor players for possible busting. */
        MonitorPlayers();
        /** Check that pathWays array exists and that current Policebot is not a testbot nor its not visible. */
        if(pathWays && this.me.name != 'robotest' && this.me.placeable.visible)
            NewDestinationAndMove(pathWays, frametime);

        /** Keep animations in sync with events. */
        CheckAnims();

        if (interval < 150) interval++;
        else {
            /** Check the amount of policebots on scene according to time TODO: FIX THIX DOES NOT WORK */
            MonitorPoliceAmount();
            interval = 0;
        }
    } 
}

/** 
 * Function to monitor police amount in scene. TODO: FIX NOT WORKING
 * Should check that time is between 18:00 and 06:00, to add more policebots.
 */
function MonitorPoliceAmount() {
    if (new Date().getHours() < 18 && new Date().getHours() > 6) {
        if (visiblePolices.length > 2) {
            for (var i in visiblePolices) {
                visiblePolices[i].placeable.visible = false;
                visiblePolices.splice(i, 1);
            }
        }
        
    } else {
        var polices = scene.EntitiesOfGroup('Polices');
        for (var i in polices) { 
            if (visiblePolices.length < 7) {
                polices[i].placeable.visible = true;
                visiblePolices.push(polices[i]);
            }
        }
    }
}

/** 
 * Checks if police has no animations active and activates basic walk animation to roll.
 */
function CheckAnims() {
    if (this.me.animationcontroller.GetActiveAnimations().length < 1)
        this.me.animationcontroller.EnableExclusiveAnimation('walk', true, 1, 1, false);
}

/**
 * Gets orientation for the source to a new destination.
 * @param {vector3} source - Source entity vector3.
 * @param {vector3} destination - Destination entitys vector3 
 * @returns {Quat} Calculated orientation to new destination in Quat.
  */
function LookAt(source, destination) {
        var targetLookAtDir = new float3();
        targetLookAtDir.x = destination.x - source.x;
        targetLookAtDir.y = destination.y - source.y;
        targetLookAtDir.z = destination.z - source.z;
        targetLookAtDir.Normalize();
        //return Quat.RotateFromTo(source, destination);
        return Quat.LookAt(scene.ForwardVector(), targetLookAtDir, scene.UpVector(), scene.UpVector());
}

/**
 * New destination for Policebot and the actual movement of the police. Current destination has to be between 25 and 15 meters, can be easily changed in first if structure.
 * @param {array} destination - Array full or destinations from navigation mesh.
 * @param {int} frametime - Frametime integer used for speed in the actual movement. 
  */
function NewDestinationAndMove(destination, frametime) {
    //If bot reached its goal, random a new goal and check that its valid.
    var tm = this.me.placeable.transform;
    if (reachedgoal) {
        var nextDesti = destination[random(destination.length)];
        xNow = nextDesti[0];
        zNow = nextDesti[1];
        var dist = Math.sqrt(Math.pow((xNow - this.me.placeable.Position().x), 2) + 
            Math.pow((zNow - this.me.placeable.Position().z), 2));
    
        if (dist < 25  && dist > 15 && nextDest != nextDesti) {
            nextDest = nextDesti;
        } else 
            return;
    }

    var totalLat=0;
    var totalLon=0;
    var ratioLat;
    var ratioLon; 

    //Make relative values for walking.
    var relativeLon = nextDest[0] - this.me.placeable.Position().x;
    var relativeLat = nextDest[1] - this.me.placeable.Position().z;

    //Check ratio to walk between x and z axis.
    if (Math.abs(relativeLat) >= Math.abs(relativeLon)) {
        ratioLon = Math.abs(relativeLon / relativeLat);
        ratioLat = 1;
    } else {
        ratioLat = Math.abs(relativeLat / relativeLon);
        ratioLon = 1;
    }

    var time = frametime;
    var speed = 2.0; //Speed value, can be changed to manipulate movement speed.

    //Where are we now.
    var yNow = this.me.placeable.transform.pos.y;
    var xNow = this.me.placeable.transform.pos.x;
    var zNow = this.me.placeable.transform.pos.z;

    //Movement.
    var lats = speed * time * ratioLat;
    var lons = speed * time * ratioLon;

    //Check in which quad we are moving into.
    if (relativeLon >= 0) var finalMovementX = xNow + lons;
    else var finalMovementX = xNow - lons;

    if (relativeLat >= 0) var finalMovementZ = zNow + lats;
    else var finalMovementZ = zNow - lats;

    //Add movement value to total position value.
    totalLat += lats;
    totalLon += lons;
    tm.pos.x = finalMovementX;
    tm.pos.z = finalMovementZ;
    //Assign value to script owner - Police bot
    this.me.placeable.transform = tm;

    /** Check if orientation was set yet. */
    if (!orientationSet) {
        this.me.placeable.SetOrientation(LookAt(this.me.placeable.transform.pos, 
            new float3(xNow, this.me.placeable.transform.pos.y, zNow)));
        orientationSet = true;
    }

    /** Check if we have reached the destination and change reachedgoal to true. */
    if (totalLat > Math.abs(relativeLat) || totalLon > Math.abs(relativeLon)) {
        reachedgoal = true;
        totalLat = 0;
        totalLon = 0;
        orientationSet = false;
    } else
        reachedgoal = false;
}

/**
 * Parse .obj file so that we get only z and x from vertices. We do not use faces at the moment, or the Y coordinate.
 * @param {Object} data - Data of navigation mesh .obj file.
 * @returns {array} xNz - X and Z values in Array for police to use as navigation array.
*/
function parseObjData(data) {
    //Variables for the function to handle data from server.
    var objText = data.RawData();
    var verticles;
    var obj = {};
    var graph;
    /* Style what we want to get rid of. So v X,Y,Z, in each ro we take x and z*/
    var vertexMatches = QByteArrayToString(objText).match(/^v( -?\d+(\.\d+)?){3}$/gm);
    var result;
    var values = String(vertexMatches).split(",");
    var xNz = [];

    /* Take v from file and replace with empty. */
    for (i = 0; i < values.length; i++) {
        values[i] = String(values[i]).replace('v ', '');
    }

    /* Split every row from " " */
    for (i = 0; i < values.length; i++) {        
        values[i] = String(values[i]).split(" ");
    }

    if (values) {
        obj = values.map(function(vertex)
    {   
            vertex.splice(1, 1);
            values = vertex; 
            xNz.push(values);
        });
        
    }
    return xNz; 
}

/**
 * Monitors players in the scene and busts the ones within 15 meters. In if statement its easy to change busting value in meters.
*/
function MonitorPlayers() {
    var Players = scene.EntitiesOfGroup('Player');

    for (var i in Players) {
        var json = null;
        var x = this.me.placeable.Position().x;
        var z = this.me.placeable.Position().z;

        //Calculating distance.
        var distance = Math.sqrt(Math.pow((x - Players[i].placeable.Position().x), 2) + 
                Math.pow((z - Players[i].placeable.Position().z), 2));

        if (Players[i].dynamiccomponent.GetAttribute('spraying')) {
                if (distance < 15) {
                    playerToBeBusted = Players[i];

                    http.client.Get("http://vm0063.virtues.fi/gangsters/").Finished.connect(function(req, status, error) {
                        if (status == 200) {
                            UploadBustedPlayers(req.body);
                        }
                    });
                } else
                    continue; 
        }
    }
}


/**
 * Monitors players in the scene and busts the ones within 15 meters. In if statement its easy to change busting value in meters.
 * Send busted players to the GameAnalytics with some data from them.
 * @param {JSONArray} players - Players in SAG as JSON array to be parsed.
*/
function UploadBustedPlayers(players) {
    if (players.RawData() == [] || players.RawData() == "" || !players)
        return;

    var playerId = null;
    var playersToString = QByteArrayToString(players.RawData());
    var json = JSON.parse(playersToString);

    if(!json) return;

    for (var i in json) {
        /** Check if player that was busted is in our players, if so check also that player info was not already sent to GameAnalytics. */
        if (json[i].username == playerToBeBusted.name) {
				for (var i in bustedPlayers) {
					if (playerToBeBusted.name == bustedPlayers[i]) return;
				}
                playerId = json[i].id;
        } else {
            /** If no player is busted check for sent players and remove possible sent players from the array, since the player is not busted anymore. */
			for (var i in bustedPlayers)
				if (bustedPlayers[i] == json[i].username)
					bustedPlayers.splice(bustedPlayers[i], 1);
                continue;
		}
    }

    var jsonNew = JSON.stringify(json);
    var qByteJson = EncodeString('UTF-8', json);

    if (jsonNew && playerId) {
        //Animate player and police for busting.
        this.me.animationcontroller.PlayAnim('busted', 0, 'busted');
        playerToBeBusted.dynamiccomponent.SetAttribute('spraying', false);
        playerToBeBusted.animationcontroller.EnableExclusiveAnimation('busted', false, 1, 1, false);

        playerToBeBusted.animationcontroller.AnimationFinished.connect(function(){
            this.me.animationcontroller.StopAllAnims(0);
            this.me.animationcontroller.PlayLoopedAnim('walk', 0, 'walk');
        });

        if (!playerId) return;

        /** Send player to our middle server to remove points from player and add busted information. */
        http.client.Get("http://vm0063.virtues.fi/police/" + playerId + "/").Finished.connect(function(req, status, error) {
			if (status == 200)
				Log('Police busted succesfully.');
         });
         
        var pos = String(this.me.placeable.transform.pos.x) + ',' + String(this.me.placeable.transform.pos.y) + ',' + String(this.me.placeable.transform.pos.z);
		pos = pos.split(",").join('%2C');
        http.client.Get("http://vm0063.virtues.fi/events/" + String(8) + "/playername" + '/' + "Police" + "/" + "playerpos/" + pos +                                         '/playerinfo' + '/' + "Police" 
			+ '/playerdata' + '/' + String(123) + '/').Finished.connect(function(req, status, error) {
				if (status == 200) {
					bustedPlayers.push(json[i].username);

				}
	  });
        
    }
}

/* Json encoding and decoding functions. **/
function QByteArrayToString(qbytearray)
{
    var ts = new QTextStream(qbytearray, QIODevice.ReadOnly);
    return ts.readAll();
}

function DecodeString(encoding, qbytearray)
{
    var strEncoding = new QByteArray(encoding);
    var codec = QTextCodec.codecForName(strEncoding);
    return codec.toUnicode(qbytearray);
}

function EncodeString(encoding, string)
{
    var strEncoding = new QByteArray(encoding);
    var codec = QTextCodec.codecForName(strEncoding);
    return codec.fromUnicode(string);
}

function random(n) {
    seed = new Date().getTime();
    seed = (seed*9301+49297) % 233280;
    
    return (Math.floor((seed/(233280.0)* n)));
}