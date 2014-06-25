/**  Script to monitor player events for spraying. Moves player and enables spraying.
* @author Lasse Annola <lasseann@ee.oulu.fi>
*/

/** 
 *  Script to monitor player events for spraying. Moves player and enables spraying.
 * @module PlayerScript
 */

// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script

/** We use this holder for the venues that are active. Just to prevent parsing same data over and over again.
 * @type array */
var currentVenues = null;

/** interval int for Update function
 * @type int */
var interval = 0;

/** 
 * Represents a player object where we hold inside some information.
 * @constructor 
 * @param {Object} entity - Entity that has current script.
 * @param {Object} comp - Unknown, not used just being passed by realXtend. 
 */
function Player(entity, comp) {
	this.me = entity;
	engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
	engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");
	SetLogChannelName("PlayerScript"); //this can be anything, but best is your aplication name

	//Hook frame update to Update function.
	frame.Updated.connect(this, this.Update);
}

/** 
 * Update function that is ran on every frame. Inside we use interval so that get is launched approx. every 3 seconds.
 * @param {int} frametime - Int to check how many frames are through.
 */
Player.prototype.Update = function(frametime) {
	if (!server.IsRunning()) {
		//GET venues
        if (interval >= 300) {
            interval = 0;
            var transfer = asset.RequestAsset("http://vm0063.virtues.fi/venues/?active", "Binary", true);
            transfer.Succeeded.connect(MyHandler);
        } else interval++;
	} 
}

/** 
 * Function to parse JSON data from server and send it to CheckVenue to monitor venues.
 * @param {JSONArray} venues - JSON data from our Django server.
 */
function MyHandler(venues) {
	//Make sure we dont parse data if it has not been changed.
	if (currentVenues == venues.RawData())
		return;
	else
        currentVenues = venues.RawData();

	venues.name = "asset";
	var data = JSON.parse(venues.RawData());
	for(var i=0; i<data.length; ++i) {
		SaveVenueDataGetGangsters(data[i]);
	}	
}

/** 
 * Collects data from each venue that it gets and gets gangsters, then calls CheckVenueAndPlayer for future proceedings, and passes all data gathered forward.
 * @param {JSONObject} venueData - Each Venue as JSONObject
 */
function SaveVenueDataGetGangsters (venueData) {
	//Get name for venue.
	var venueName = venueData.name;
	//Gangster currently spraying the venue.
	var gangsterSpraying = venueData.gangsterSpraying;
	//Latitude and longitude of current venue.
	var latAndLon = [venueData.latitude, venueData.longitude];
	//Boolean to know if spraying is initialized for this venue.
	var spraying = venueData.sprayinginitialized;
	//All players in the system, this because ?active is not always on time or can remove players really fast
	// if they idle.
	var players = asset.RequestAsset("http://vm0063.virtues.fi/gangsters/","Binary", true);
	//If we got data we call CheckVenueAndPlayer and pass needed variables.
	players.Succeeded.connect(function(){
		CheckVenueAndPlayer(players, gangsterSpraying, latAndLon, venueName);
	});
}

/** 
 * Parse player data from JSONArray and check if a Venue has player spraying it. After this check if the current player found from Venue is spraying at the moment. If So Call MovePlayer and pass player, coords and venuename.
 * @param {JSONArray} players - Players as JSONArray from DJango server
 * @param {int} gangsterSpraying - Gangster that is spraying current venue.
 * @param {array} latAndLon - Venue coordinates in GPS.
 * @param {String} venueName - Name of current venue.
 */
function CheckVenueAndPlayer(players, gangsterSpraying, latAndLon, venueName) {
	var data = JSON.parse(players.RawData());
    	for(var i=0; i<data.length; ++i) {
    		//If the ID from venue matches to this current player.
    		if (data[i].id == gangsterSpraying) {
    			var player = scene.EntityByName(data[i].username);    			
    			
    			//If player exists in scene.
    			if (player) {
    				player.dynamiccomponent.SetAttribute("spraying", true);
    				//Call MovePlayer with desired data.
    				MovePlayer(player, latAndLon, venueName);
    			} else 
                    Log('No initial players in scene. ' + player);
    		}
    	}
}

/** 
 * Move player to Venue what its spraying at and enable spraying animation.
 * @param {Object} player - Player that we are manipulating.
 * @param {array} latAndLon - Array holding gps coordinates.
 * @param {String} venueName - Name of current venue.
 */
function MovePlayer(player, latAndLon, venueName) {

	/* Variables:
	latZero, lonZero = 0 coordinates on 3D map. 
	longitudeInMeters, latitudeInMeters = gps coordinates to match 3d scene values with Haversine formula (CalcLong & CalcLat).
	dlon, dlat = Check in which Quart the coordinates are.
	placeable, transform = player placeable object to assign coordinates in 3d World.
	plane = The plane to which player is spraying, saved to a variable for orientation.
	*/

    player.dynamiccomponent.SetAttribute('venueSprayed', venueName);
	var latZero =  65.012115;
	var lonZero = 25.473323;

	var longitudeInMeters = CalcLong(lonZero, latAndLon[1], latZero, latAndLon[0]);
	var latitudeInMeters = CalcLat(latZero, latAndLon[0]);
	
	var dlon = latAndLon[1] - lonZero;
	var dlat = latAndLon[0] - latZero;   
          
	var gps = player.dynamiccomponent.GetAttribute('posGPS');
	gps.x = latAndLon[1];
	gps.z = latAndLon[0];
	player.dynamiccomponent.SetAttribute('posGPS', new float3(gps.x, 0, gps.z));

	//Set to null for next time.
	latAndLon[0] = null;
	latAndLon[1] = null;
	
	//Check in which quarter values are.
	if (dlon < 0) 
		longitudeInMeters = -longitudeInMeters;
	if (dlat > 0)
		latitudeInMeters = -latitudeInMeters;

	var placeable = player.placeable;
	var transform = placeable.transform;

	var plane = scene.EntityByName("graffiti-plane-" + venueName);

	//TODO: Orientation not working here, maybe would after assigning it many times, have to test this.
	placeable.SetOrientation(LookAtPoint(player.placeable.WorldPosition(), plane.placeable.WorldPosition()));
	
	/* Get Y coordinate by shooting a RayCast down to get the mesh y coordinate. */
	var raycast = CheckYCoordinate(new float3(longitudeInMeters, 11, latitudeInMeters));

	transform.pos.x = longitudeInMeters;
	transform.pos.y = raycast.pos.y; //Highest of Oulu3D
	transform.pos.z = latitudeInMeters;

	//Assign new values to player placeable object.
	placeable.transform = transform;

	//Enable spraying animation.
	player.animationcontroller.EnableExclusiveAnimation('spray', false, 1, 1, false);
	//When animation has finished stop animations and play stand animation.
	player.animationcontroller.AnimationFinished.connect(function(){
		player.dynamiccomponent.SetAttribute('spraying', false);
		player.animationcontroller.EnableExclusiveAnimation('stand', true, 1, 1, false);
	});
}	

/** Function to check the Y for transform by shooting raycast down to get the coordinate for ground level.
 * @param {Object} position - Position to which avatar is moving, shoot raycast from it.
 *
 */
var CheckYCoordinate = function (position) {
	var ray = new Ray(position, new float3(0, -1, 0));
	var result = scene.ogre.Raycast(ray, 0xffffffff);
	Log("RayCast hitpoint is " + result.pos);


	return result;
} 


/** 
 * Orientation function for player, currently not working for some reasoń. 
 * @param {Vector3} from - Vector holding in player position.
 * @param {Vector3} what - holding in destination position.
 */
function LookAtPoint(from, what) {
    var targetLookatDir = what.Sub(from);
    targetLookatDir = targetLookatDir.Normalized();
    var endRot = Quat.LookAt(scene.ForwardVector(), targetLookatDir, scene.UpVector(), scene.UpVector());
    return endRot;
}

/** Haversine based function to transform GPS longitude to Cartesian X coordinate in our 3D model. Expected that world is flat, works well on a small area.
 * @param {double} lon1 - Real world latitude coordinate from Oulu3D 0,0,0 (Has to be checked always from the actual model.)
 * @param {double} lat1 - Real world longitude coordinate from Oulu3D 0,0,0 (Has to be checked always from the actual model.)
 * @param {double} lat2 - Real world latitude from the players current position.
 * @param {double} lon2 - Real world longitude from the players current position.
 * @returns {double} longitude in Cartesian meters, used as X position of player.
  */
function CalcLong(lon1, lon2, lat1, lat2){
	var radius = 6371; // km
	var dlat = 0;
	var dlon = (lon2-lon1) * (Math.PI/180);
	var a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1*(Math.PI/180)) 
		* Math.cos(lat2*(Math.PI/180)) * Math.sin(dlon/2) * Math.sin(dlon/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = radius * c;

	var longitudeInMeters = d * 1000;

	return longitudeInMeters;
}

/** Haversine based function to transform GPS latitude to Cartesian Z coordinate in our 3D model. Expected that world is flat, works well on a small area.
 * @param {double} lat1 - Real world longitude coordinate from Oulu3D 0,0,0 (Has to be checked always from the actual model.)
 * @param {double} lat2 - Real world latitude from the players current position.
 * @returns {double} latitude in Cartesian meters, used as Z position of player.
 */
function CalcLat(lat1, lat2){
	var radius = 6371; //km

	var dlat = (lat2-lat1) * (Math.PI/180);
	var dlon = 0;

	var a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1*(Math.PI/180)) 
		* Math.cos(lat2*(Math.PI/180)) * Math.sin(dlon/2) * Math.sin(dlon/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = radius * c;

	var latitudeInMeters = d * 1000;

	return latitudeInMeters;
}

