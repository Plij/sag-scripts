/*  Script to change Weather and other phenomenons for the scene to relate real world.
    Can be used for other Meshmoon scenes as well, replace line 64 with your own location reference and add weather effects or 
	copy from SAG scene
 Original author Lasse Annola <lasseann@ee.oulu.fi>
*/

/* 
  Script to change Weather and other phenomenons for the scene to relate real world. Currently no sound, if some is recorded should be added here.
  @module Time&Weather
 */
 
// Include our utils script that has asset storage and bytearray utils etc.
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/class.js, Script
// !ref: http://meshmoon.data.s3.amazonaws.com/app/lib/json2.js, Script

/* We are using OpenWeatherMap.org free API to get weather data for StreetArtGangs */

engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/class.js");
engine.IncludeFile("http://meshmoon.data.s3.amazonaws.com/app/lib/admino-utils-common-deploy.js");
SetLogChannelName("Time And Weather Script"); //this can be anything, but best is your aplication name

frame.Updated.connect(Update);

var interval = 45000;
var timeinterval = 1500;
var day = null;
var updateTimes = ['08:00', '14:00', '20:00'];
var entity = scene.EntityByName('WeatherEntity');

//Time for SkyX
function Update (frametime) {
           /*if (timeinterval >= 1500)
           {
            timeinterval = 0;
            //setTimeForSkyX();
            }else timeinterval++;*/

	if (interval >= 45000) {
		interval = 0;	
		getWeather();
	} else 
		interval++;
}


function setTimeForSkyX() {
	var date = new Date();
	var hrs = date.getHours();
	
	//Add 0 to time, so its 7:07 not 7:7
	if (date.getMinutes() < 10)
		this.me.skyx.time = date.getHours() + '.' + 0 + date.getMinutes();
	else 
		this.me.skyx.time = date.getHours() + '.' + date.getMinutes();
        Log (this.me.skyx.time);

}

/* Use OpenWeatherMap API to get current weather information from Oulu. 
	We use these to manipulate the scene into looking how Oulu actually is at the moment. 
	(API is called once a day.) */
function getWeather() {
	var url = 'http://api.openweathermap.org/data/2.5/weather?id=643492';
	var transfer = asset.RequestAsset(url, "Binary", true);
	transfer.Succeeded.connect(function(){
		var json = JSON.parse(transfer.RawData());
		var name = json.name;
		var wind = json.wind;
		var speedOfWind = wind.speed;
        var directionOfWind = wind.deg - 90;
		var cloudPercentage = parseFloat(json.clouds.all).toFixed(2);
        
		this.me.skyx.cloudCoverage = cloudPercentage;
        this.me.skyx.cloudAverageSize = cloudPercentage;
		this.me.skyx.windSpeed = speedOfWind;
        this.me.skyx.windDirection = directionOfWind;
        
		var mainWeather = json.weather[0].main; //For weather effects	
		var desc = json.weather[0].description;
        var json = JSON.parse(transfer.RawData());
        var sunrise = parseInt(json.sys.sunrise) + 3600;
        var sunset = parseInt(json.sys.sunset) + 3600;
        var current = parseInt(json.dt) + 0; //Needs some addjustement, approximate
       
        var sunriseDate = new Date();
        sunriseDate.setTime(sunrise * 1000);
        var sunriseH = parseFloat(sunriseDate.getHours()).toFixed(2); //TODO make this more precise              
        var sunsetDate = new Date(sunset);
        sunsetDate.setTime(sunset * 1000);
        var sunsetH = parseFloat(sunsetDate.getHours()).toFixed(2);
        this.me.skyx.sunriseTime = sunriseH;
        this.me.skyx.sunsetTime = sunsetH;
        
         var curDate = new Date();
         curDate.setTime(current * 1000);
        if (curDate.getMinutes() < 10)
		this.me.skyx.time = curDate.getHours() + '.' + 0 + curDate.getMinutes();
	    else 
		this.me.skyx.time = curDate.getHours() + '.' + curDate.getMinutes();
        
        Log("CurrentTime: " + curDate + "sunset: " + sunsetH + "--" + "sunrise: " + sunriseH);
        
		setWeather(mainWeather, desc);
	});
	
	Log('getWeather');

}

function setWeather(mainWeather, desc) {
/* Different weathers that can be manipulated in scene. */
		Log(mainWeather + "--" + desc);
		if (mainWeather == 'Snow' && desc != 'light snow') {
			/* Harder snow effect and streets get snowy. */
			entity.mesh.materialRefs = new Array('http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/snowflakes_prop_mat.material');
			entity.mesh.meshRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/snowflakes_prop.mesh';
			entity.particlesystem.particleRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/snow_prop.particle';
                              entity.particlesystem.enabled = true;
		} else if (desc == 'light snow') {
			/* Add lighter snow effect, streets dont get snowy */
			entity.mesh.materialRefs = new Array('http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/snowflakes_prop_mat.material');
			entity.mesh.meshRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/snowflakes_prop.mesh';
			entity.particlesystem.particleRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/lightsnow_prop.particle';
                              entity.particlesystem.enabled = true;
		}

		if (mainWeather == 'Rain' && desc == 'light rain') {
			//Light rain
			entity.mesh.materialRefs = new Array('http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2_mat.material');
			entity.mesh.meshRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2.mesh';
			entity.particlesystem.particleRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/lightrain_prop.particle';
                              entity.particlesystem.enabled = true;
		} else if (mainWeather == 'Rain') {
			//Heavier or heavy rain. Also streets are flooded
			entity.mesh.materialRefs = new Array('http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2_mat.material');
			entity.mesh.meshRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2.mesh';
			entity.particlesystem.particleRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop.particle';

			this.me.fog.mode = 3;
			this.me.fog.startDistance = 2;
                              this.me.fog.endDistance = 100;
			this.me.fog.expDensity = 1,0;
                              entity.particlesystem.enabled = true;
		} else 
                        entity.particlesystem.enabled = false;
          
		if (mainWeather == 'Mist') {
			this.me.fog.mode = 2;
			this.me.fog.startDistance = 5;
			this.me.fog.expDensity = 0,01;
		} else {
			this.me.fog.mode = 0;
		}

		if (mainWeather == 'Thunderstorm') { //TODO add the lighning prop
			//Heavier or heavy rain. Also streets are flooded
			entity.mesh.materialRefs = new Array('http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2_mat.material');
			entity.mesh.meshRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop2.mesh';
			entity.particlesystem.particleRef = 'http://meshmoon.eu.scenes.2.s3.amazonaws.com/mediateam-b4527d/test2/particle/rain_prop.particle';

			this.me.fog.mode = 3;
			this.me.fog.startDistance = 2;
                              this.me.fog.endDistance = 100;
			this.me.fog.expDensity = 1,0;
                              entity.particlesystem.enabled = true;
		}
}