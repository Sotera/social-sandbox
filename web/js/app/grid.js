

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
		cb(response)
	});
}
