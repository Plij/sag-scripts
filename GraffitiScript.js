/**  Script for keeping our spray tags in sync according to their owners. Also events for spraying have to happen on time.
* @author Lasse Annola <lasseann@ee.oulu.fi>
*/

/** 
 * Script for keeping our spray tags in sync according to their owners. Also events for spraying have to happen on time.
 * @module GraffitiScript
 */

// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script

engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");
SetLogChannelName("GraffitiScript"); //this can be anything, but best is your aplication name
Log("Script starting...");

/** Array for Graffiti plane materials.
 * @type array */
 var graffitiLinks = ["http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/graffiti/blue.material",
"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/graffiti/purple.material", "http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/graffiti/green.material"];

/** Current scene we are in.
 * @type Object */
var scene = me.ParentScene();

/** Simple interval int value for Update.
 * @type int */
var interval = 0;

/** Players and venues linked in one array to know which Gang is spraying which plane, to prevent spraying to get old values from cache and spray with wrong gang color.
 * @type array
 */
var playersNVenuesLinked = [];

//Connect Update function to frametime signal. 
frame.Updated.connect(Update);

/** 
 * Update function that is ran on every frame. Inside we use interval so that get is launched approx. every 2 seconds.
 * @param {int} frametime - Int to check how many frames are through.
 */
function Update (frametime) {
	if (!server.IsRunning()) {
        if(interval >= 200) {
        	http.client.Get("http://vm0063.virtues.fi/venues/?active").Finished.connect(function(req, status, error) {
				if (status == 200) {
					MyHandler(req.body);
				}
			});
        } else 
            interval = interval+1;             
	}
}

/** 
 * Function to parse JSON data from server and send it to CheckVenue to monitor venues.
 * @param {JSONArray} myAsset - JSON data from our Django server.
 */
var MyHandler = function (myAsset) {
	var data = JSON.parse(myAsset);
	for(var i=0; i<data.length; ++i) {
		CheckVenue(data[i]);
	}
}

/** 
 * Function to check which player owns which venue after we pass the iterated venue from MyHandler to CheckVenue. Also makes sure that spraying state is correct.
 * @param {JSONObject} venueData - Each venue from our server as a JSONObject.
 */
function CheckVenue (venueData) {
	//Variables for data we want to collect.
	var venueName = venueData.name;
	var venueGang = venueData.gang;
	var player = null;
	
	var plane = scene.EntityByName("graffiti-plane-" + venueName);

	//Check venue owner
	if (venueGang == "Blue Angels" || venueGang == "Blue Knights" && plane) {
		plane.mesh.materialRefs = new Array(graffitiLinks[0]);
	} else if (venueGang == "Purple Knights" && plane) {
		plane.mesh.materialRefs = new Array(graffitiLinks[1]);
	} else if (venueGang == "Green Shamans" && plane) {
		plane.mesh.materialRefs = new Array(graffitiLinks[2]);
	}
	
    var players = scene.EntitiesOfGroup('Player');
    for (var i in players) {
	  	//Make sure that particles are never enabled for nothing, before going further. (They stay sometimes on after quit.)
      	if (players[i].dynamiccomponent.GetAttribute('spraying') == true) { player = players[i]; }
      	else { DisableAfterSpray(); continue; }

      	var bothEntities = new Object();
		//Put spraying particle on, if venue is spraying.
		var venueSpraying = venueData.sprayinginitialized;

		//Make sure that right color and right venue are changed. We use RealXtends DynamicComponent for this.
		if (venueSpraying == 1 && plane.particlesystem.enabled == false && player) {
			if (player.dynamiccomponent.GetAttribute('gang') == "blue" && player.dynamiccomponent.GetAttribute('venueSprayed') == venueData.name) {
				plane.particlesystem.particleRef = "http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle-graffiti-plane/bluespray.particle";
                bothEntities.player = player;
                bothEntities.venue = plane;
                playersNVenuesLinked.push(bothEntities);
			} else if (player.dynamiccomponent.GetAttribute('gang') == "purple" && player.dynamiccomponent.GetAttribute('venueSprayed') == venueData.name) {
				plane.particlesystem.particleRef = "http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle-graffiti-plane/purplespray.particle";
	            player.dynamiccomponent.SetAttribute('venueSprayed', 'EmptyVenue');	
                bothEntities.player = player;
                bothEntities.venue = plane;
                playersNVenuesLinked.push(bothEntities);
			} else if (player.dynamiccomponent.GetAttribute('gang') == "green" && player.dynamiccomponent.GetAttribute('venueSprayed') == venueData.name) {
				plane.particlesystem.particleRef = "http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle-graffiti-plane/greenspray.particle";
				Log('Green Spraying');
                bothEntities.player = player;
                bothEntities.venue = plane;
                playersNVenuesLinked.push(bothEntities);
			} 	
			//In the end enable particlesystem.
	        plane.particlesystem.enabled = true;

		} else if (venueSpraying == 0 && plane && player) {
			plane.particlesystem.enabled = false;
            plane.particlesystem.particleRef = "";
		}
	}
}

/** 
 * Keeping sure that dynamiccomponent spraying is not staying on, state guard basically.
 */
function DisableAfterSpray() {
    for (var i in playersNVenuesLinked) {
        if (playersNVenuesLinked[i].player.dynamiccomponent.GetAttribute('spraying') == false) {
            playersNVenuesLinked[i].venue.particlesystem.enabled = false;
            playersNVenuesLinked.splice(i, 1);
        }
    }    
}

