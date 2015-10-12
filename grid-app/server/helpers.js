var ngeohash = require('ngeohash');

module.exports = {
	
	dateAdd : function(date, interval, units) {
	  var ret = new Date(date); //don't change original date
	  switch(interval.toLowerCase()) {
	    case 'year'   :  ret.setFullYear(ret.getFullYear() + units);  break;
	    case 'quarter':  ret.setMonth(ret.getMonth() + 3*units);  break;
	    case 'month'  :  ret.setMonth(ret.getMonth() + units);  break;
	    case 'week'   :  ret.setDate(ret.getDate() + 7*units);  break;
	    case 'day'    :  ret.setDate(ret.getDate() + units);  break;
	    case 'hour'   :  ret.setTime(ret.getTime() + units*3600000);  break;
	    case 'minute' :  ret.setTime(ret.getTime() + units*60000);  break;
	    case 'second' :  ret.setTime(ret.getTime() + units*1000);  break;
	    default       :  ret = undefined;  break;
	  }
	  return ret;
	},

	geohash2geojson : function(hash, props) {
		// props = props | {};
		
		var data1 = ngeohash.decode_bbox(hash)
		
		// Convert geohash format to d3 path format
		var datas = []
		for(i = 0; i <= data1.length; i++) {
			var tmp = [data1[i%data1.length], data1[(i+1)%data1.length]]
			if(i%2 == 0) {
				tmp.reverse()
			}
			datas.push(tmp)
		}
		
		return {
			"type" : "Feature",
			"geometry" : {
				"type" : "Polygon",
				"coordinates" : [datas]
			},
			"properties" : props
		}
	},

	leaflet2elasticsearch : function(leaflet_bounds) {
		return {
			"bottom_right" : {
				"lat" : leaflet_bounds._southWest.lat, 
				"lon" : leaflet_bounds._northEast.lng
			},
			"top_left" : {
				"lat" : leaflet_bounds._northEast.lat,
				"lon" : leaflet_bounds._southWest.lng
			}
		}
	}
}