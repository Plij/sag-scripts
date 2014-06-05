// Include the json parse/stringify library. We host it here if you want to use it:
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script


engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");

SetLogChannelName("EventLogging"); //this can be anything, but best is your aplication name
Log("Script starting");
frame.Updated.connect(Update);


if (server.IsRunning()) {
    server.UserConnected.connect(UsrConnected);
    server.UserDisconnected.connect(UsrDisconnected);
}

var interval = 0; 
var sentPlayers = [];
var players = [];
var hitCount = 0;
var intervalForUpdate = 0;
var intervalForConnection = 0;
var sentPlayersBust = [];

var c = 1;

function uid() {
    var d = new Date(),
        m = d.getMilliseconds() + "",
        u = ++d + m + (++c === 10000 ? (c = 1) : c);

    return u;
}

function Update(frametime) {
	if(server.IsRunning()) {
		if (intervalForUpdate < 500) intervalForUpdate++;
		else {
			if (sentPlayers.length > 0 || sentPlayersBust.length > 0) {
			sentPlayersLoop:
			for (var i in sentPlayers) {
				var players = scene.EntitiesOfGroup('Player');
				for (var n in players) {
					if (players[n].dynamiccomponent.GetAttribute('spraying') == true && sentPlayers[i].name != players[n].name) { sendMobilePlayerInfo(); sendWatcherInfo(true, 6); Log('Player sendiiing!');  break sentPlayersLoop; }
					else if (players[n].dynamiccomponent.GetAttribute('spraying') == false && sentPlayers[i].name == players[n].name) { sentPlayers.splice(i, 1); sendWatcherInfo(false, 6);  break sentPlayersLoop; }
				}
				http.client.Get("http://vm0063.virtues.fi/gangsters/").Finished.connect(function(req, status, error) {
					if (status == 200) {
						var json = JSON.parse(req.body);
						for (var n in json) {
							for (var y in sentPlayersBust) {
								if (sentPlayersBust[y] == null) break;
								if (json[n].bustedviapolice != 0 && sentPlayersBust[y].name != json[n].name) { sendMobilePlayerInfo(json[n].name, 2); sendWatcherInfo(true, 6); break;}
								else if (json[n].bustedviapolice == 0 && sentPlayersBust[y].name == json[n].name) { sentPlayersBust.splice(i, 1); sendWatcherInfo(false, 6); break;  }	                  
							}
						}
					}
				});

			}

			} else {
				var players = scene.EntitiesOfGroup('Player');
				for (var n in players) {
					if (players[n].dynamiccomponent.GetAttribute('spraying') == true) { logPlayerInfoOnSpray(); sendWatcherInfo(true, 6); Log('Send watcher info'); }
				}
				http.client.Get("http://vm0063.virtues.fi/gangsters/").Finished.connect(function(req, status, error) {
					if (status == 200) {
						var json = JSON.parse(req.body);
						for (var n in json) {
							if (json[n].bustedviapolice != 0) { sendMobilePlayerInfo(json[n].name, 2); sendWatcherInfo(true, 7); }
						}
					}
				});
					
			}
			intervalForUpdate = 0;
		}
	} 
}

function sendWatcherInfo(spraying, eventId) {
	Log('SendWatcherInfo ' + spraying  + " -- " + eventId);
	for (var i in players) {
		//make sure that info is sent only once.
		if (!spraying) { players[i].sent = false; return; }
		Log('In watcherSEnding..');
		//Get position of watcher and include it in post to GA.
		var watchers = scene.FindEntitiesContaining('Avatar');
		for (var n in watchers) {
			Log('In watcherSEndingpolling watchers' + watchers[i]);

			if (watchers[n].description == players[i].player) {
				var pos = String(watchers[n].placeable.transform.pos.x) + ',' + String(watchers[n].placeable.transform.pos.y) + ',' + String(watchers[n].placeable.transform.pos.z);
				pos = pos.split(",").join('%2C');
				Log(pos + "for watcher entity");
			} 
		}

		if (!pos) return;

        http.client.Get("http://vm0063.virtues.fi/events/" + eventId + "/playername" + '/' + players[i].player + "/" + "playerpos/" + pos + '/playerinfo' + '/' +  players[i].player 
			+ '/playerdata' + '/' + players[i].id + '/').Finished.connect(function(req, status, error) {
					if (status == 200) {
						players[i].sent = true;
					}
		});
	}
}

//Check if any player is spraying.
function logPlayerInfoOnSpray(){
	var Players = scene.EntitiesOfGroup('Player');
	for (var i in Players) {
		if (Players[i].dynamiccomponent.GetAttribute('spraying') == true) {
			sendMobilePlayerInfo(Players[i].name, 1);
		}
	}
}

/* Send info of player to Django which will parse information and forward it to Game Analytics */
function UsrConnected(cid, connection) {
	var username = connection.GetProperty('username');
	var userid = uid();
	//Add Watcher with its session id to our players array, until he disconnects.
	var obj = new Object();
	obj.player = username;
	obj.id = userid;
	obj.sent = false;
	players.push(obj);

	sendUserInfo(obj.player, userid, 4);
}

function UsrDisconnected(cid, connection) {
	var username = connection.GetProperty('username');
	for (var i in players) {
		if (players[i].player == username) {
			sendUserInfo(players[i].player, players[i].id, 5); 
			players.splice(players[i], 1);

		}
	}
}

/* This is used to track disconnections and connections of players with same player_id -- Parameters are distinguished in Django as proper ones according
	to eventId */
function sendUserInfo(player, uniqId, eventId) {
	   http.client.Get("http://vm0063.virtues.fi/events/" + eventId + "/playername" + '/' + player + "/" + "playerpos/" + "nopos" + '/playerinfo' + '/' + player 
			+ '/playerdata' + '/' + uniqId + '/').Finished.connect(function(req, status, error) {
				if (status == 200) {
				}
	  });
}

//Get desired information from players, when someone is spraying.
function sendMobilePlayerInfo(player, eventId) {
	var player = scene.EntityByName(player);
    if(!player) return
    if (sentPlayers.indexOf(player) != -1) return;
	Log("Player that we are sending to GA " + player);

	if (player.bustedviapolice == true) sentPlayersBust.push(player);
	else sentPlayers.push(player);
	
	var name = player.name;
	var gang = player.dynamiccomponent.GetAttribute('gang');
	var pos = String(player.dynamiccomponent.GetAttribute('posGPS').x) + ',' + String(player.placeable.transform.pos.y) + ',' + String(player.dynamiccomponent.GetAttribute('posGPS').z);
	Log(pos);
	pos = pos.split(",").join('%2C');
	http.client.Get("http://vm0063.virtues.fi/events/" + eventId + "/playername" + '/' + name + "/" + "playerpos/" + pos + '/playerinfo' + '/' + gang 
		+ '/playerdata' + '/' + uid() + '/').Finished.connect(function(req, status, error) {
				if (status == 200) {
				}
	});
}



