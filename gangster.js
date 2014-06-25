/** Script for adding active players into scene according to their position in real world.
* @author Lasse Annola <lasseann@ee.oulu.fi>
*/

// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");

SetLogChannelName("Gangster Script"); 
Log("Script starting...");

/** 
 * Script for adding active players into scene according to their position in real world. 
 * @module GangsterScript 
 */

/** materialRefs include different team materials as urls from Meshmoon server 
 * @type Array */
var materialRefs = ["http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-blue/avatar-blue.material", 
	"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-green/avatar-green.material", 
		"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-purple/avatar-purple.material"];

/** skeletonRefs include different team skeletons as urls from Meshmoon server 
 * @type Array */
var skeletonRefs = ["http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-blue/avatar-blue.skeleton", 
	"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-green/avatar-green.skeleton",
			 "http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-purple/avatar-purple.skeleton"];

/** meshRefs include different meshes as urls from Meshmoon server 
 *@type Array */
var meshRefs = ["http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-blue/avatar-blue.mesh",
	"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-green/avatar-green.mesh",
		"http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/avatars/avatar-purple/avatar-purple.mesh"];

/** boolean to determine if player will walk to destination. Will be set false after we get to final destination.
 * @type bool */
var gWalkToDestination = false;
/** Player holder for entity in walking, if we walk.
 * @type Object */
var globalEntity;
/** Global variables for latitude and longitude when we are walking.
 * @type double */
var globalLat;
/** Global variables for latitude and longitude when we are walking.
 * @type double */
var globalLon;
/** Current latitude and longitude while walking to determine the amount of distance.
 * @type int */
var currentLat = 0; 
/** Current latitude and longitude while walking to determine the amount of distance.
 * @type int */
var currentLon = 0;	
/** Simple int interval to optimize Update function.
 * @type int */ 
var interval = 0;

//Hook Update to frame.Updated
frame.Updated.connect(Update);

/** 
 * Update function that is ran on every frame.
 * @param {int} frametime - Int to check how many frames are through.
 */
 function Update (frametime) {
    if (!server.IsRunning()) {
        //GET active users
        if (interval > 200) {
            var transfer = asset.RequestAsset("http://vm0063.virtues.fi/gangsters/?active", "Binary", true);
            transfer.Succeeded.connect(function(){
            	ParseJson(transfer, frametime);
            	interval = 0;
            });
        } else 
            interval++;

        if (gWalkToDestination) 
            WalkToDestination(frametime); 
           
        //Monitor animations
        for (var i in scene.EntitiesOfGroup('Player'))
            if(scene.EntitiesOfGroup('Player')[i].animationcontroller.GetActiveAnimations().length < 1)
                checkAnims(scene.EntitiesOfGroup('Player')[i]);        
    }
}


/**
 * Parse JSON we get from our Django Server and call AddAvatar to add every active player to scene..
 * @param {JSONArray} myAsset - JSON Array that we get from our server.
 * @param {int} frametime - frametime in int for every time we update frame.
*/
var ParseJson = function (myAsset, frametime) {
	myAsset.name = "asset";

    //Checker for null value and empty json.
    if (myAsset.RawData() == [] || myAsset.RawData() == "")
        return;

    var data = JSON.parse(myAsset.RawData());
    for(var i=0; i<data.length; ++i) {
        addAvatar(data[i], frametime);
    }
}

/**
 * Make sure that only active users are shown in scene.
*/
var IsAvatarActive = function() {
	 var transfer = asset.RequestAsset("http://vm0063.virtues.fi/gangsters/", "Binary", true);
     transfer.Succeeded.connect(function() {
     	var json = JSON.parse(transfer.RawData());
     	var activePlayers = asset.RequestAsset("http://vm0063.virtues.fi/gangsters/?active");
     	activePlayers.Succeeded.connect(function() {

     		//If data is empty return.
     		if (activePlayers.RawData() == "") {
     			return false;
     		}

     		var jsonactive = JSON.parse(activePlayers.RawData());

     		for (i = 0; i < jsonactive.length; i++) {
     			for (i = 0; i < json.length; i++) {
     				//If player exists in active and /gangsters/, return true.
     				if (jsonactive.username == json.username) {
     					return true;
     				} 
     			}
     		}
     	});

     });  
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
        return Quat.LookAt(scene.ForwardVector(), targetLookAtDir, scene.UpVector(), scene.UpVector());
}

/**
 * Move player to destination if new destination is more than 20m away (Check dist < 20 if you wanna change the value for movement.).
 * @param {object} user - Player who is being moved
 * @param {int} frametime - Current frametime.
*/
var MoveAvatar = function(user, frametime) {
	//0 , 0 on 3d map.
	var latZero =  65.012115;
	var lonZero = 25.473323;
            
	//Later change to this:
	var lat = user.latitude;
	var lon = user.longitude; 

	var avatar = scene.EntityByName(user.username);

	var longitudeInMeters = CalcLong(lonZero, lon, latZero, lat);
	var latitudeInMeters = CalcLat(latZero, lat);
	var dlon = lon - lonZero;
	var dlat = lat - latZero;

	if (latitudeInMeters == currentLat && longitudeInMeters == currentLon) {
		return;
	} else {
		currentLat = latitudeInMeters;
		currentLon = longitudeInMeters;
	}

	if (dlon < 0) 
		longitudeInMeters = -longitudeInMeters;
	if (dlat > 0)
		latitudeInMeters = -latitudeInMeters;

	var dist = Math.sqrt(Math.pow((longitudeInMeters - avatar.placeable.Position().x), 2) + 
    	Math.pow((latitudeInMeters - avatar.placeable.Position().z), 2));
          if (avatar.dynamiccomponent.GetAttribute('spraying'))
            return;
            
	/* Check distance and that avatar exists, if so we use walking function and not teleport. */
	if (dist < 20 && avatar) {
		globalEntity = avatar;
		globalLat = latitudeInMeters;
		globalLon = longitudeInMeters;
		gWalkToDestination = true;
		return;
	}

	/* Get Y coordinate by shooting a RayCast down to get the mesh y coordinate. */
	var raycast = CheckYCoordinate(new float3(longitudeInMeters, 11, latitudeInMeters));

	var transform = avatar.placeable.transform;
	transform.pos.x = longitudeInMeters;
	transform.pos.z = latitudeInMeters;
	transform.pos.y = raycast.pos.y;
	avatar.placeable.transform = transform;
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
 * If distance to destination is less than 20meters, Avatar will animate and walk to destination.
 * @param {int} frametime - Frametime for walking speed.
*/
var WalkToDestination = function (frametime) {
    if (!globalEntity) return;

    //Enable walk if not already enabled.
    if(!globalEntity.animationcontroller.IsAnimationActive('walk', true))
        globalEntity.animationcontroller.EnableExclusiveAnimation('walk', true, 1, 1, false);

    /*	totalLat, totalLon = totals for the actual movement for every frame.
		ratioLat, ratioLon = ratio for axis X and Z, this makes the avatar move in a stable way.
		relativeLat, relativeLon = actual walking distance for x and z. 
	*/
    var totalLat=0;
    var totalLon=0;
    var ratioLat;
    var ratioLon; 
    var tm = globalEntity.placeable.transform;

    //Make relative values for walking.
    var relativeLon = globalLon - globalEntity.placeable.Position().x;
    var relativeLat = globalLat - globalEntity.placeable.Position().z;

    //Check ratio to walk
    if (Math.abs(relativeLat) >= Math.abs(relativeLon)) {
        ratioLon = Math.abs(relativeLon / relativeLat);
        ratioLat = 1;
    } else {
        ratioLat = Math.abs(relativeLat / relativeLon);
        ratioLon = 1;
    }

    //Moving the police.
    var time = frametime;
    var speed = 2.0; //Can be adjusted to a different value later.
    
    //Where are we now.
    var yNow = globalEntity.placeable.Position().y;
    var xNow = globalEntity.placeable.Position().x;
    var zNow = globalEntity.placeable.Position().z;

    //Movement.
    var lats = speed * time * ratioLat;
    var lons = speed * time * ratioLon;

    //Check in which quarter we are moving into.
    if (relativeLon >= 0) var finalMovementX = xNow + lons;
    else var finalMovementX = xNow - lons;

    if (relativeLat >= 0) var finalMovementZ = zNow + lats;
    else var finalMovementZ = zNow - lats;

    //Add movement value to total position value.
    totalLat += lats;
    totalLon += lons;
    tm.pos.x = finalMovementX;
    tm.pos.z = finalMovementZ;

    /* Get Y coordinate by shooting a RayCast down to get the mesh y coordinate. */
	var raycast = CheckYCoordinate(new float3(finalMovementX, 11, finalMovementZ));

	tm.pos.y = raycast.pos.y;
    //Assign value to script owner - Police bot
   	globalEntity.placeable.transform = tm;
   	globalEntity.placeable.SetOrientation(LookAt(globalEntity.placeable.transform.pos, 
   			new float3(xNow, globalEntity.placeable.transform.pos.y, zNow)));

    //Check if we have reached goal and assign value to global parameter, so we can monitor 
    //  easily the functionality.
    if (totalLat > Math.abs(relativeLat) || totalLon > Math.abs(relativeLon)) {
        reachedGoal = true;       
        totalLat = 0;
        totalLon = 0;
        globalEntity.animationcontroller.EnableExclusiveAnimation('stand', true, 1, 1, false);
        gWalkToDestination = false;
    } else
        reachedGoal = false;
}


/** Add avatar to scene. 
 * @param {JSONObject} user - JSONObject for every user in gangsters JSON.
 * @param {int} frametime - int for every time we go through frame.
*/
var addAvatar = function(user, frametime){
	//Check if player is on ?active list.
	var isSucceed = IsAvatarActive();

	//Currently nothing happens if player is not in the list.
	if(isSucceed == false) Log('IsnotActivebutletsseewhathappens');

	var avatarEntityName = user.username;

	//If player is already in the scene.
	if (scene.EntityByName(user.username)) {
		MoveAvatar(user, frametime);
		return;
	}

	var latLon = [user.latitude, user.longitude];
	//Set wanted properties for avatar.
	var avatarEntity = scene.CreateEntity(scene.NextFreeId(), ["RigidBody", "Avatar", "Mesh", "Script", "Placeable", "AnimationController", "DynamicComponent"]);
	avatarEntity.SetTemporary(true); // We never want to save the avatar entities to disk.               
	avatarEntity.SetName(avatarEntityName);
	avatarEntity.SetDescription(avatarEntityName);
	avatarEntity.group = "Player";
	avatarEntity.rigidbody.mass = 0;
	avatarEntity.dynamiccomponent.CreateAttribute('bool', 'spraying');
    avatarEntity.dynamiccomponent.CreateAttribute('string', 'gang');
    avatarEntity.dynamiccomponent.CreateAttribute('string' ,'venueSprayed');
    avatarEntity.dynamiccomponent.CreateAttribute('float3', 'posGPS');
	avatarEntity.placeable.visible = false;
	
	
	//Put right gang color for the player.
	if (user.color == "green") {			
		avatarEntity.mesh.materialRefs = new Array(materialRefs[1]);
		avatarEntity.mesh.meshRef = meshRefs[1];
		avatarEntity.mesh.skeletonRef = skeletonRefs[1];
	} else if (user.color == "blue") {
		avatarEntity.mesh.meshRef = meshRefs[0];
		avatarEntity.mesh.materialRefs = new Array(materialRefs[0]);
		avatarEntity.mesh.skeletonRef = skeletonRefs[0];
	} else if (user.color == "purple") {
		avatarEntity.mesh.meshRef = meshRefs[2];
		avatarEntity.mesh.materialRefs = new Array(materialRefs[2]);
		avatarEntity.mesh.skeletonRef = skeletonRefs[2];
	}

	avatarEntity.dynamiccomponent.SetAttribute('gang', user.color);
	//Set angularfactor to 0 0 0, so player wont fall down.
	avatarEntity.rigidbody.angularFactor = new float3(0,0,0);
	var script = avatarEntity.script;
	//Add player script to all players.
	script.className = "SAGScripts.Player";
	script.runOnLoad = true;

	var lat = latLon[0];
	var lon = latLon[1];
	//0,0 on the map.
	var latZero =  65.012115;
	var lonZero = 25.473323;

	var longitudeInMeters = CalcLong(lonZero, lon, latZero, lat);
	var latitudeInMeters = CalcLat(latZero, lat);
	var dlon = lon - lonZero;
	var dlat = lat - latZero;

	//Check in which quad player is on.
	if (dlon < 0) 
		longitudeInMeters = -longitudeInMeters;
	if (dlat > 0)
		latitudeInMeters = -latitudeInMeters;

	/* Get Y coordinate by shooting a RayCast down to get the mesh y coordinate. */
	var raycast = CheckYCoordinate(new float3(longitudeInMeters, 11, latitudeInMeters));

	var placeable = avatarEntity.placeable;
	var transform = placeable.transform;
	transform.pos.x = longitudeInMeters;
	transform.pos.y = raycast.pos.y;
	transform.pos.z = latitudeInMeters;
	placeable.transform = transform;

	Log("Adding player in " + placeable.transform.pos);
	//Make sure animations are correct.
	checkAnims(avatarEntity);
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

/** Checks animation state of player, can be standing or spraying depending on if animations have been already loaded.
 * @param {Object} avatar - Player avatar object in the Scene.
 */
function checkAnims(avatar) {
	/* If we come from addPlayer function we use the avatar passed from there. Otherwise we poll the players. */
	if (avatar) {
        if (avatar.animationcontroller.GetAvailableAnimations().length > 0){
            avatar.placeable.visible = true;
            }      
			
                        
		//Check if is spraying, dont activate anymore, let spray anim go first.
		if (avatar.animationcontroller.GetActiveAnimations().length > 0)
			return;

		if (avatar.dynamiccomponent.GetAttribute('spraying'))
			return;

		avatar.animationcontroller.EnableExclusiveAnimation('stand', true,0,0, false);	
	} else {
		var players = scene.EntitiesOfGroup('Player');
		for (var i in players) {
			if (players[i].animationcontroller.GetAvailableAnimations().length > 0){
                                players[i].placeable.visible = true;
                                Log(players[i].Name() + "Players that have animations");
                                }        
			//Check if is spraying, dont activate anymore, let spray anim go first.
			if (players[i].animationcontroller.GetActiveAnimations().length > 0)
				return;

			if (players[i].dynamiccomponent.GetAttribute('spraying'))
				return;

			players[i].animationcontroller.EnableExclusiveAnimation('stand', true,0,0, false);	
		}
	}
}