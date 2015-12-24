var request = require("request");

bounds = {
	_southWest:{
		lat:13.7140377964387,
		lng:100.48524856567383
	},
	_northEast:{
		lat:13.78140218253957,
		lng:100.57519912719727
	}
};

request( {
        url     : "http://localhost:3000/scrape",
        method  : "POST",
        json    : true,
        headers : {
            "content-type": "application/json",
        },
        body : {
				"name"           : "instagram_bangkok",
				"comments"       : "",
				"leaflet_bounds" : bounds,
				"time"           : "2015-08-15",
				"user"           : "Test User"
				}
      });