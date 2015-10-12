// // Map layer
// var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
//   attribution : "Social Sandbox",
//   maxZoom     : 18
// });

// // Grid layer

function make_turf_grid() {
	var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
	var cellWidth  = .2;
	var units      = 'miles';
	var turf_data = turf.squareGrid(extent, cellWidth, units);
	return turf_data;
}

function make_bbox_grid(turf_data) {
	// Processing square grid
	z        = _.chain(turf_data['features']).map(function(x) {return x['geometry']['coordinates'][0]}).value()
	min_x    = _.map(z, function(x) { return _.min(_.map(x, function(x) {return x[0]} )) })
	max_y    = _.map(z, function(x) { return _.max(_.map(x, function(x) {return x[1]} )) })
	top_left = _.zip(min_x, max_y)
	top_left = _.map(top_left, function(x) {return {'x' : x[0], 'y' : x[1]}})

	max_x        = _.map(z, function(x) { return _.max(_.map(x, function(x) {return x[0]} )) })
	min_y        = _.map(z, function(x) { return _.min(_.map(x, function(x) {return x[1]} )) })
	bottom_right = _.zip(max_x, min_y)
	bottom_right = _.map(bottom_right, function(x) {return {'x' : x[0], 'y' : x[1]}})

	return _.zip(top_left, bottom_right)
}

// bbox_data here is global, which is wrong
function elasticsearch_data(cb) {
	fetch({'start_date' : 'test', 'end_date' : '201'}, function(response) {
		console.log('bbox_data', response.data);
		bbox_data = response.data;
		utimes    = response.utimes;
		cb(bbox_data)
	});
}


turf_data = make_turf_grid()

// var gridLayer  = L.geoJson(turf_data, {
// 	style : {
// 	    "color"       : "red",
// 	    "weight"      : .25,
// 	    "opacity"     : 1,
// 	    "fillOpacity" : .2
// 	}
// });

// // Initialize the map
// var map = new L.Map('map', {
//   center : new L.LatLng(39.2833, -76.6167),
//   zoom   : 13,
//   layers : [baseLayer, gridLayer]
// });

// -- Geojs --

function make_map() {
	var map = geo.map({
	    node: '#map',
	    center: {
	      x: -76.6167,
	      y: 39.2833
	    },
	    zoom: 9
	});

	map.createLayer(
	    'osm',
	    {
	      baseUrl: 'https://c.tiles.mapbox.com/v3/cwhong.map-hziyh867'
	    }
	);
	
	return map;
}

function draw(gridLayer, bbox_data, ut) {
	i = i || 0;
	
	console.log('bbox_data :: ', bbox_data);
	
	if(gridLayer) {
		gridLayer.canvas().selectAll('rect')
		.attr('opacity', function(d) {
			var tmp = _.findWhere(d['time'], {'key' : ut})
			if(tmp) {
				return tmp['doc_count'] / 20;	
			} else {
				return 0
			}
		})
	} else {
		gridLayer = map.createLayer('feature', {renderer : 'd3'});
		counter = 0;
		gridLayer.canvas().selectAll('rect').data(bbox_data).enter().append('rect')
			.attr('x', function(d) {return map.gcsToDisplay(d['pos'][0])['x']})
			.attr('y', function(d) {counter++; return map.gcsToDisplay(d['pos'][0])['y']})
			.attr('width', function(d) {
				return map.gcsToDisplay(d['pos'][1])['x'] - map.gcsToDisplay(d['pos'][0])['x'];
			})
			.attr('height', function(d) {
				return map.gcsToDisplay(d['pos'][1])['y'] - map.gcsToDisplay(d['pos'][0])['y'];
			})
			.attr('fill', 'red')
			.attr('opacity', function(d) {
				var tmp = _.findWhere(d['time'], {'key' : ut})
				if(tmp) {
					return tmp['doc_count'] / 20;	
				} else {
					return 0
				}
			})
			
		console.log('# of squares :: ', counter);
		
	}
	return gridLayer;
}

var gridLayer, map, bbox_data, utimes;
var i = 0;

map = make_map(map);
// bbox_data = make_bbox_grid(turf_data);

// This sets bbox_data, which is obviously wrong
elasticsearch_data(function() {
	console.log(utimes)
	gridLayer = draw(undefined, bbox_data, utimes[i]);
});


$(document).keypress(function(e) {
    if((e.keyCode || e.which) == 46) {
    	i = i + 1;
	    gridLayer = draw(gridLayer, bbox_data, utimes[i]);
    } else if((e.keyCode || e.which) == 44){
    	i = i - 1;
	    gridLayer = draw(gridLayer, bbox_data, utimes[i]);
    }
});

// map.draw();


// // ---- Getting data -----

function fetch(params, cb) {
	$.ajax({
		type        : "POST",
		contentType : 'application/json',
		dataType    : "json",
		url         : 'get_data',
		data        : JSON.stringify(params),
		success     : cb,
		error: function(error) {
			alert(error)
		}
	});	
}




// $(document).keypress(function(e) {
// 	if((e.keyCode || e.which) == 46) {
// 	    // state['start'] = state['start'] + state['inc'];
// 	    // state['end']   = state['end'] + state['inc'];
// 	    get_data();
// 	} else if((e.keyCode || e.which) == 44){
// 	    // state['start'] = state['start'] - state['inc'];
// 	    // state['end']   = state['end'] - state['inc'];
// 	    get_data();
// 	}
// });