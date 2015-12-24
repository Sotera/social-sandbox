
// var boxes_to_names = {};

var current_scrape_obj  = undefined;
var current_scrape_name = undefined;

var start_date = undefined;
var end_date   = undefined;

var playback = false;


var num_scrapes = 0;

var event_recs = [];

var eventIcon = L.icon({
    iconUrl: 'EventIcon.jpg',
    iconSize:     [25, 25]
});

var rickshaw_graph = new RickshawS3C({
    "date_callback" : function(_min_date, _max_date) {
        min_date = _min_date;
        max_date = _max_date;
        $('#events-btn').css('display', 'inline');
        $('#events-btn').off('click').on('click', show_handler());
    }
});

$(document).ready(function() {
// <draw-map>
	console.log(document.cookie);
	var baseLayer = L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution : "Social Sandbox",
        maxZoom     : 18
	});

	var map = new L.Map('map', {
        center : new L.LatLng(0,0),
        zoom   : 2,
        layers : [baseLayer]
	});

	var drawnItems = new L.FeatureGroup();
	map.addLayer(drawnItems);
    	
	function make_drawControl() {
		var drawControl = new L.Control.Draw({
			edit: {
				featureGroup: drawnItems
			},
			draw : {
				polyline : false,
				polygon  : false,
				circle   : false,
				marker   : false,
				rectangle : {
					shapeOptions : {
						color : "red",
						fillOpacity : .00
					}
				}
			}
		});
		map.addControl(drawControl);

		map.on('draw:created', function (e) {
			console.log('e', e);
			drawnItems.addLayer(e.layer);
			$('#init-scrape-btn').css('display', 'inline');
			$('#analyze-btn').css('display', 'inline');
		});

		map.on('draw:deleted', function(e) {
			if(drawnItems.getLayers().length == 0) {
				$('#init-scrape-btn').css('display', 'none');
				$('#analyze-btn').css('display', 'none');
			}
		})
	}

	make_drawControl();
// </draw-map>

// <scrape-management>
function load_scrapes() {
	socket.emit('get_existing', function(response) {
		console.log('get_existing :: ', response);
		_.map(response.types, function(x) {
			load_scrape(x);
		});
	});
}

// Breaking apart the scrape loading and the scrape settings
function load_scrape(scrape_name) {
	socket.emit('load_scrape', scrape_name, function(response) {
        
		num_scrapes ++;
        
		var geo_bounds = elasticsearch2leaflet(response.geo_bounds);
		var rec = L.rectangle(geo_bounds, {
			color       : "red",
			weight      : 2,
			fillOpacity : 0
		});
		rec.on('click', function(e){ 
            if (current_scrape_name !=  scrape_name) {
    			set_scrape(scrape_name);
			}
		});
		rec.addTo(map);

		d3.select("#info").html(num_scrapes + " regions scraped<br>" + "Select a region or start a new scrape");

		// boxes_to_names[rec._leaflet_id] = response;
		
		//map.fitBounds(geo_bounds);
	});
}

function set_scrape(scrape_name) {
    d3.select("#eventresults").remove();
    d3.select('#images').selectAll("img").remove();
    d3.select("#info").html("");
    
	socket.emit('set_scrape', scrape_name, function(response) {
        console.log('set_scrape :: ', response);
		
        current_scrape_name = scrape_name;
		
		$('#start-stream').css('display', 'inline');
		$('#stop-stream').css('display', 'inline');
		$('#go-live').css('display', 'inline');
		
		$('#scrape-name').html(response.scrape_name);
	    $('#scrape-start-date').html(response.temp_bounds.start_date);
	    $('#scrape-end-date').html(response.temp_bounds.end_date);
	    
        var geo_bounds = elasticsearch2leaflet(response.geo_bounds);
	    map.fitBounds(geo_bounds);
        
	    current_scrape_obj = response;
	    // set load_events to true to load events on area selection
	    analyze_area({ "area" : geo_bounds, "load_events": false });
	});

}

function load_ned(start_date, end_date) {
    d3.select("#eventresults").remove();
    socket.emit('load_ned', start_date, end_date, function(response) {
        
        console.log('load_ned response ::', response);
        
        // Make table
        var t = d3.select("#events").append("table");
        t.attr("class", "table bordered").attr("id", "eventresults");
        
        var th = t.append("thead").append("tr");
        th.append("th").text("Date");
        th.append("th").text("Count");

        var tbody = t.append("tbody");
        var tr = tbody.selectAll("tr").data(
            _.sortBy(response.events, function(d) { return - d['count']; })
        ).enter()
        .append("tr")
        .attr('class', 'bordered-table-row')
        .on('click', function(d) {
            show_ned(d);
        })
        .on('mouseover', function(d) {
            d3.select(this).style('color', 'red');
            _.map(event_recs, function(rec) {
                if(rec.options.id == d.id) {
                    rec.setStyle({"color" : "red"});
                } else {
                    rec.setStyle({"color" : "yellow"});
                }
            });
        })
        .on('mouseout', function(d) {
            d3.select(this).style('color', 'white');
            _.map(event_recs, function(rec) {
                rec.setStyle({"color" : "yellow"});
            });
        })

        tr.append("td").append('small').text(function(d){
            var dates = [
                moment(new Date(d['created_time']['min'] * 1000)).format('YYYY-MM-DD HH:mm'),
                moment(new Date(d['created_time']['max'] * 1000)).format('YYYY-MM-DD HH:mm')
            ]
            
            return dates[0] + ' to ' + dates[1];
        })
        
        tr.append("td").text(function(d){
            return d['count'];
        });
        
        tr.append('div').attr('position', 'absolute').attr('top', 0).attr('bottom', 0).attr('left', function(d) {return 10});
        
        // Add to map, with link to network graph
        _.map(response.events, function(event) {
            
            var geo_bounds = event.location;
            var southWest  = L.latLng(geo_bounds.lat.min, geo_bounds.lon.max);
            var northEast  = L.latLng(geo_bounds.lat.max, geo_bounds.lon.min);
            geo_bounds     = L.latLngBounds(southWest, northEast);
            
            var rec = L.rectangle(geo_bounds, {
                id          : event.id,
                color       : "yellow",
                weight      : 2,
                fillOpacity : .25
            });
            rec.on('click', function(e){ show_ned(event); });
            
            // Add click handler
            event_recs.push(rec);
            rec.addTo(map)            
        });
    });
}

function show_ned(event) {
    console.log('show_ned :: ', event);
    
    // Show timeline
    analyze_area({
        "cluster_id" : event.id,
        "load_events": false
    });
    
    // Show images
    d3.select('#images').selectAll("img").remove();
    socket.emit('show_ned_images', event.id, function(response) {
        _.map(response.images, function(img) {
            sidebar_image(img);
        });
    });
    
    // Show graph
    socket.emit('show_ned', event.id, function(response) {
        render_graph(
            format_graph(response.detail),
            {
                "onHover" : function(node) {
                    console.log('node:: ', node.id);
                    
                    socket.emit('url_from_id', node.id, function(d) {
                        m = draw_image(d);
                    });
                }
            }
        );
    });
}

// </scrape-management>


// <socket>
	var grid;
	var line_data = [];
    
	var socket = io.connect('http://localhost:3000/');
	socket.on('give', function(data) {
        // Update date
		$('#current-date').html(data.current_date);
        
        // Update linegraph
		rickshaw_graph.update({
            "x" : new Date(data.current_date).getTime() / 1000,
            "y" : data.count
        });
		
		// // Draw lines
		d3.select('#line_svg').remove();
		
		// Add new information
		line_data.push({'date' : data.date, 'count' : data.count});
		// Make sure it's sorted
		line_data = _.sortBy(line_data, function(x) {return x.date});
		// Remove second to last element
		if(line_data.length > 1) {
			line_data.splice(-2, 1);	
		}
		// If we just finished a time unit, we add another one for protection from the next slice
		if(data.full_unit) { 
			line_data.push({'date' : data.date, 'count' : 0});
		}
		
		//draw_line(line_data);
		
		// Show images
	    _.map(data.images, function(img) {
			 draw_image(img);
			 sidebar_image(img);
	     });

		var params = {
			"users" : {
				"css_selector" : ".side-bar .col1",
				"color" : "yellow"
			},
			"tags" : {
				"css_selector" : ".side-bar .col2",
				"color" : "limegreen"
			}
		}
		
		// d3.select(params.users.css_selector).selectAll("svg").remove();
		// draw_trending(data.users, params.users);
		
		// d3.select(params.tags.css_selector).selectAll("svg").remove();
		// draw_trending(data.tags, params.tags);
		
		// Grid
		/*
		if(!grid) {
			grid = init_grid(data.grid)
			reset_grid(grid)
		} else {
			draw_grid(grid, data.grid)
		}
		*/
		
	});
// </socket>

//function loadTimeFromEvent(d) {
//	selectedImages = [];
//
//	var bounds  = current_scrape_obj.geo_bounds;
//	var time    = new Date(Number(d.event.datetime)).getTime() - (60*30);
//	var endtime = new Date(Number(time)).getTime() + (60*30);
//
//	var bounds = {
//        bottom_right : {
//            lat : d.event.geoloc.lat - .005,
//            lon : d.event.geoloc.lon + .005
//        },
//        top_left : {
//            lat : d.event.geoloc.lat + .005,
//            lon : d.event.geoloc.lon - .005
//        }
//    };
//    
//	d3.select('#images').selectAll("img").remove();
//	socket.emit('load_time', current_scrape_name, time, endtime, bounds, function(response) {
//		console.log('load_time :: ', response)
//		_.map(response.images, function(img) {
//			 draw_image(img);
//			 sidebar_image(img);
//	     });
//	});
//}

function loadTime(time,endtime) {
	selectedImages = [];
    
	var bounds  = current_scrape_obj.geo_bounds;
    
	if( playback ) {
		endtime = (new Date(time + (60*60))).getTime();
	}
    
	if(drawnItems.getLayers()[0] != undefined ) {
		bounds = drawnItems.getLayers()[0].getBounds();
	}
    
	d3.select('#images').selectAll("img").remove();
    
	socket.emit('load_time', current_scrape_name, time, endtime, bounds, function(response) {
		console.log('load_time :: ', response);
		_.map(response.images, function(img) {
			 draw_image(img);
			 sidebar_image(img);
	     });
	});
}

// <analyzing area>
// All this does right now is show the timeseries
function analyze_area(params) {
	socket.emit('analyze_area', params, function(data) {
		console.log('analyze_area :: ', data)
		var mindate = null;
		var maxdate = null;
        // Show timeseries
        rickshaw_graph.init(_.map(data.timeseries, function(d){
			if(mindate == null) {
				mindate = d.date;
			}

			if(maxdate == null) {
				maxdate = d.date;
			}

			if(d.date > maxdate){
				maxdate = d.date;
			}

			if(d.date < mindate){
				mindate = d.date;
			}

			return {
                "x" : new Date(d.date).getTime() / 1000,
                "y" : d.count
            };
		}));

		rickshaw_graph.min_date = mindate;
		rickshaw_graph.max_date = maxdate;

		$('#chart').on('click', function() {
        	loadTime(rickshaw_graph.min_date,rickshaw_graph.max_date);
    	});
	});
	console.log('here');
	//if ( params.load_events ){
		//load_ned(null,null);
	//}
}
// <analyzing area>

// <grid> -- The d3 here is sloppier than I would hope

	// Drawing grid
	// function make_turf_grid() {
	// 	var extent     = [-76.6167 - .1, 39.2833 - .1, -76.6167 + .1, 39.2833 + .1];
	// 	var cellWidth  = .5;
	// 	var units      = 'miles';
	// 	var turf_data  = turf.squareGrid(extent, cellWidth, units);
	// 	return turf_data;
	// }


	// Project onto map
	function projectPoint(x, y) {
		var point = map.latLngToLayerPoint(new L.LatLng(y, x));
		this.stream.point(point.x, point.y);
	}
	
	var project = d3.geo.path().projection(d3.geo.transform({point: projectPoint}));

	function init_grid(grid_data) {
		// Initializing d3 layer
		if(grid_data.features.length > 0) {
			var svg     = d3.select(map.getPanes().overlayPane).append("svg");
			var g       = svg.append("g").attr("class", "leaflet-zoom-hide");
			var feature = g.selectAll("path").data(grid_data.features).enter().append("path");
            
			return {
				svg        : svg,
				g          : g,
				feature    : feature,
				grid_data  : grid_data
			}			
		}
	}
	
	// This works, but it's slow... Seems like we should just be able to change
	// the property of the data
	// Could probably match an ID of the underlying data to the updated data...
	function draw_grid(grid, data) {
		console.log('draw_grid :: ', grid, ' :: ', data);
		grid.g.selectAll("path").remove()
		var feature = grid.g.selectAll("path").data(data.features).enter().append("path");
		
		feature.attr('d', project)
			.attr('opacity', function(d) {
				// return Math.random()
				// return Math.log10(d.properties.count) / 10; // Hardcoded scaling 
				return d.properties.count;
			})
			.attr('fill', 'red')
	}

	// Move D3 with map
	function reset_grid(grid) {
		// Fix bounding box
		if(grid) {
			var bounds      = project.bounds(grid.grid_data),
			    topLeft     = bounds[0],
			    bottomRight = bounds[1];
			  
			grid.svg.attr("width",   bottomRight[0] - topLeft[0])
			    .attr("height", bottomRight[1] - topLeft[1])
			    .style("left",  topLeft[0] + "px")
			    .style("top",   topLeft[1] + "px")

			grid.g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

			// Redraw
			draw_grid(grid, grid.grid_data);			
		}
	}

	map.on("viewreset", function() {
		reset_grid(grid)
	});


	// var grid_data = make_turf_grid();
	// var grid = init_grid(grid_data)
	
	// reset_grid(grid)
	// map.on("viewreset", function() {
	// 	reset_grid(grid)
	// });
// </GRID>

// <IMG>
	var imageHash = {};
	var selectedImages = {};
	var LeafIcon = L.Icon.extend({
	    options: {
	        iconSize:[100, 100],
	    }
	});
	
	function sidebar_image(d) {
		$('#images').prepend('<img id="' + d.id + '" src="' + d.img_url + '" class="side-bar-image" />');
		$('#' + d.id).dblclick(function(){
			d3.select(this).style("border-color","yellow");
			selectedImages[d.id] = d;
			window.open(d.link, '_blank');
		});

		$('#' + d.id).click(function(){
			console.log(d);
			if (d.id in selectedImages) {
				d3.select(this).style("border-color","grey");
				delete selectedImages[d.id];
			}
			else {
				d3.select(this).style("border-color","yellow");
				selectedImages[d.id] = d;
			}
			if (_.keys(selectedImages).length == 0){
				$('#comment-btn').css('display', 'none');
				$('#show-user-btn').css('display', 'none');
			}
			else {
				$('#comment-btn').css('display', 'inline');
				$('#show-user-btn').css('display', 'inline');
			}
		});
	}
	
	function draw_image(d) {
		var m = L.marker([d.loc.lat, d.loc.lon], {
			icon: new LeafIcon({
				iconUrl : d.img_url,
				id      : d.id
			})
		});
		m.addTo(map);
		
		setTimeout(function(){  map.removeLayer(m); }, 2000);
		
		imageHash[d.img_url] = d;
		
		d3.select("img[src=\"" + d.img_url + "\"]").transition()
			.duration(2000)
			.style("opacity", 0);
			
		d3.selectAll(".leaflet-marker-icon")
			.on("mouseover",function(d){
				d3.select(this)
					.style("width","150px")
					.style("height","150px")
				})
			.on("mouseout",function(d){
				d3.select(this)
					.style("width","100px")
					.style("height","100px")
				});
		
		d3.selectAll(".leaflet-marker-icon")
			.on("click",function(d){
				window.open(imageHash[this.src].link, '_blank');
			});
        
        return m;
	}

	function draw_user_image(d) {
		if(d.location != undefined) {
				var m = L.marker([d.location.latitude, d.location.longitude], {
				icon: new LeafIcon({
					iconUrl : d.images.thumbnail.url,
					id      : d.id
				})
			});
			m.addTo(map);
			
			setTimeout(function(){ 
				map.removeLayer(m);
			}, 18000);
		}
		/*
		imageHash[d.img_url] = d;
		
		d3.select("img[src=\"" +d.img_url + "\"]").transition()
			.duration(6000)
			.style("opacity", 0);
			
		d3.selectAll(".leaflet-marker-icon")
			.on("mouseover",function(d){
				d3.select(this)
					.style("width","150px")
					.style("height","150px")
				})
			.on("mouseout",function(d){
				d3.select(this)
					.style("width","50px")
					.style("height","50px")
				});
		
		d3.selectAll(".leaflet-marker-icon")
			.on("click",function(d){
				window.open(imageHash[this.src].link, '_blank');
			});
		*/
	}
//</IMG>

	// ----- Interaction ------

	// Handle key presses
	$(document).keypress(function(e) {
	    if((e.keyCode || e.which) == 46) {
		    reset_grid(grid)
	    } else if((e.keyCode || e.which) == 44){
		    reset_grid(grid)
	    }
	});

// <top-users>
	function draw_trending(orig_data, params) {
		var w = $(params.css_selector).width(),
		    h = $(params.css_selector).height() / orig_data.length;
		
		var margin = {top: 5, right: 10, bottom: 5, left: 0},
		    width  = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;
		
		var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.000Z").parse;
		
        var data = _.map(orig_data, function(b) {
        	return {
        		"key" : b.key,
        		"timeseries" : _.map(b.timeseries, function(x) {
		            return {
		                "date"  : parseDate(x.date),
		                "count" : + x.count
		            }        			
        		})
        	}
        });
        
        // Calculate bar width
        var bar_width = 3;
                
        var x = d3.time.scale().range([0, width]);    
        x.domain(d3.extent(
        	_.chain(data).pluck('timeseries').flatten().pluck('date').value()
        )).nice();
        
        var y = d3.scale.linear().range([height, 0]);
        y.domain([0, d3.max(
        	_.chain(data).pluck('timeseries').flatten().pluck('count').value()	
        )]);

        var svg = d3.select(params.css_selector).selectAll('svg')
        			.data(data).enter()
        				.append('svg:svg')
        				.attr('class', 'user-ts')
						.attr('height', height)
						.attr('width', width);
        
        svg.append("g")
            .append("text")
            .attr("x", 2)
            .attr("y", 0)
            .attr("dy", ".71em")
            .attr("text-anchor", "start")
            .attr("font-size", "1.1em")
            .attr('fill', 'white')
            .text(function(d) { return d.key});
		    
        svg.selectAll(".bar")
            .data(function(d) {console.log('d :: ', d); return d.timeseries})
            .enter().append("rect")
            .style("fill",  params.color)
            .attr("x",      function(d) { return x(d.date); })
            .attr("width",  bar_width)
            .attr("y",      function(d) { return y(d.count) })
            .attr("height", function(d) { return height - y(d.count); })
            .on('mouseover', function(e) {
                d3.select(this).style('fill', function() {return "white"})
            })
            .on('mouseout',  function(e) {
                d3.select(this).style('fill', function() {return params.color})
            })
            .append('title')
            .text(function(d) { return d.date + ' / ' + d.count });

	}
// </top-users>

// <GRAPH>
	function draw_line(data) {
		var w = $('#timeseries').width(),
		    h = $('#timeseries').height();

		var margin = {top: 5, right: 5, bottom: 30, left: 5},
		    width  = w - margin.left - margin.right,
		    height = h - margin.top - margin.bottom;

		var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%S.000Z").parse;
		// var parseDate = d3.time.format("%d-%b-%y").parse;

		var x = d3.time.scale().range([0, width]);
		var y = d3.scale.linear().range([height, 0]);

		var xAxis = d3.svg.axis().scale(x).orient("bottom");

		var yAxis = d3.svg.axis()
		    .scale(y)
		    .orient("left");

		var path = d3.svg.line()
		    .x(function(d) { return x(d.date); })
		    .y(function(d) { return y(d.count); });

		var svg = d3.select("#timeseries").append("svg").attr("id","line_svg")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		_data = _.map(data, function(d) {
			return {
				"date"  :  parseDate(d.date),
				"count" : + d.count
			}
		});

		x.domain(d3.extent(_data, function(d) { return d.date; }));
		y.domain([0, d3.max(_data, function(d) { return d.count; })]);
			
		svg.append("g")
		  .attr("class", "x axis")
		  .attr("transform", "translate(0," + height + ")")
		  .call(xAxis);

		var feature = svg.append("path")
			  .datum(_data)
			  .attr('d', path)
			  .attr("class", "line")
			  .attr('stroke', 'white');
		feature.on("click", function(d){
			console.log(d);
		});
	}
// </GRAPH>

// <events>
	$('#start-stream').on('click', function() {
		rickshaw_graph.reset();
		playback = true;
		socket.emit('start_giver', function() {
			console.log('start_giver :: ');
			line_data = [];
		});
	});

	$('#stop-stream').on('click', function() {
		playback = true;
		socket.emit('stop_giver', function() {
			console.log('stop_giver :: ');
			// ... nothing else yet ...
		});
	});

	$('#go-live').on('click', function() {
		playback = false;
		rickshaw_graph.reset();
		socket.emit('realtime', function() {
			console.log('realtime :: ');
			// ... nothing else yet ...
		});
	});

	$('#init-scrape-btn').on('click', function() {
		$("#init-modal").modal('show');
	});

	$('#show-user-btn').on('click', function() {
		_.map(_.uniq(_.map(_.values(selectedImages),function(d){ return d.user_id;})), function(user) {
			socket.emit('scrape_user', user, function(response) {
				console.log(response);
				_.map(response.data, function(image) {
					draw_user_image(image);
				});
			});
		});	
	});

    show_handler = function() {
        return function() {
            load_ned(min_date, max_date);
            $('#events-btn').text('Hide Events');
            $('#events-btn').off('click').on('click', hide_handler());
        }
    }
    hide_handler = function() {
        return function() {
            _.map(event_recs, function(rec) {
                map.removeLayer(rec);
            });
            event_recs = [];
            
            $("#graph").css('display', 'none');
            set_scrape(current_scrape_name);
            
            $('#events-btn').text('Show Events')
            $('#events-btn').off('click').on('click', show_handler());
        }
    }
    $('#events-btn').on('click', show_handler())
    
	$('#analyze-btn').on('click', function() {
		analyze_area({
            "area" : drawnItems.getLayers()[0].getBounds()
        });
	});

	$('#comment-btn').on('click', function() {
		_.keys(selectedImages).map(function(media) {
			socket.emit('alert_user', {text:'test',image:media}, function(response) {
				console.log('response from scrape_user :: ', response);
			});
		});	
	});
	
		
	$('#init-modal-form-submit').on('click',function() {
		socket.emit('init_scrape', {
			"name"           : $( "#init-modal-form-name" ).val(),
			"comments"       : $( "#init-modal-form-comment" ).val(),
			"leaflet_bounds" : drawnItems.getLayers()[0].getBounds(), // Rectangle bounds
			"time"           : $("#init-modal-form-start-date").val(),
			"user"           : "dev_user",
			"key"			 : getCookie('justin')
		}, function(response) {
			console.log('response from init_scrape :: ', response);
			//setTimeout(load_scrape($( "#init-modal-form-name" ).val()),5000);
		});		
		
		$('#init-modal').modal('hide');
	});
    
	/*			
		// Click on button to start a new scrape
		$('#start-new-scrape').on('click', function() {
			$('#first-modal').modal('hide');
			make_drawControl();
		});
		
		// Click on button to look at an existing scrape
		$('#start-existing-scrape').on('click', function() {
			$('#first-modal').modal('hide');
			$('#existing-modal').modal('show');
			
			socket.emit('get_existing', function(response) {
				console.log('response', response)
				
				// Make list of places
				var content = $('<div>');
				_.map(response.types, function(x) {
					var tmp = $('<button>').css('display', 'block').addClass('btn btn-primary').addClass('scrape-name-btn').html(x)
					tmp.on('click', function(e) {
						$('#existing-modal').modal('hide');
						console.log('>>>>', e);
						set_scrape(e.target.innerText);
					})
					tmp.appendTo(content);
				});
				
				$('#existing-modal .modal-body').html(content);	
			});
			
		});
	*/
	
// </events>

// <init>
//$('#first-modal').modal('show');
$('#init-scrape-btn').css('display', 'none');
$('#events-btn').css('display', 'none');
$('#analyze-btn').css('display', 'none');
$('#comment-btn').css('display', 'none');
$('#show-user-btn').css('display', 'none');
load_scrapes();
// </init>



})

// <helpers>
function elasticsearch2leaflet(geo_bounds) {
	var southWest = L.latLng(geo_bounds.bottom_right.lat, geo_bounds.top_left.lon);
	var northEast = L.latLng(geo_bounds.top_left.lat, geo_bounds.bottom_right.lon);
	return L.latLngBounds(southWest, northEast);
}

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}
// </helpers>
