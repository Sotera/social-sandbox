
var _        = require('underscore')._,
    ngeohash = require('ngeohash'),
       async = require('async'),
     helpers = require('./helpers'),
      moment = require('moment'),
          es = require('elasticsearch');
          
var localClient = new es.Client({hosts : ['http://10.1.94.103:9200/']});

var NewEventDetector = require('./events');

function Giver(client, socket, index) {
	
    this.ned         = new NewEventDetector();
	this.index       = index;
	this.scrape_name = undefined;
	
	this.client = client;
    this.event_client = localClient;
	this.socket = socket;

	this.temp_bounds  = undefined;

	this.current_date = undefined;

	// Streaming Settings
	//
	// With these params, we skip ahead 'every_interval' 'intervals' every '_speed' milliseconds,
	// and show data from the paste 'trailing_interval' 'intervals' on the grid heatmap.
	//
	// NB : In live mode, _speed should match every_interval
	this.interval          = 'hour';  
	//this.interval          = 'second';  go live setting
	this.trailing_interval = 1;        
	// this.every_interval    = 10;//(2 * 30);  go live setting
	this.every_interval    = 1;//(2 * 30);  
		
	this.grid_precision = 6;
	this.geo_bounds     = undefined
	
	this.live     = false;
	this.running  = false;	
	
	// Private variables
	// this._speed      = 10000; // Speed of playback (in milliseconds) go live setting
	this._speed      = 1000 * 3; // Speed of playback (in milliseconds)
	this._process    = undefined;
	this._max_images = 1000;
}

// <set-scrape>
Giver.prototype.show_ned_images = function(cluster_id, cb) {
    var query = {
        "size"    : 999,
        "_source" : ["location", "created_time", "images.low_resolution.url", "id", "link", "user"],
        "sort"    : [{
            "created_time": {
                "order": "asc"
            }
        }],
        "query" : {
            "terms" : {
                "_id" : this.ned.cluster_to_id[cluster_id]
            }
        }
    }
    
    this.client.search({
        index : this.index,
        type  : this.scrape_name,
        body  : query
    }).then(function(response) {
        cb({
            "images" : _.map(response.hits.hits, function(hit) {
                return {
                    'loc' : {
                        'lat' : hit._source.location.latitude,
                        'lon' : hit._source.location.longitude,
                    },
                    'img_url' : hit._source.images.low_resolution.url,
                    'id'      : hit._source.id,
                    'link'    : hit._source.link,
                    'user'    : hit._source.user.username,
                    'user_id' : hit._source.user.id
                }
            })
        });
    });
}

Giver.prototype.show_ned = function(cluster_id, cb) {
    var _this = this;
    
    var query = {
        "size"  : 999,
        "query" : {
            "terms" : {
                "_id" : this.ned.cluster_to_id[cluster_id]
            }
        }
    }
    
    this.event_client.search({
        index : 'events',
        // type  : this.scrape_name,
        type : 'hajj_wide',
        body  : query
    }).then(function(response) {
        _this.ned.set_detail(_.pluck(response.hits.hits, '_source'));
        
        cb({
            'detail' : _this.ned.make_graph(response.hits.hits)
        });
    });
}

Giver.prototype.load_ned = function(start_date, end_date, cb) {
    var _this = this;
    
    this.ned.reset();
    
    var query = {
      "size"    : 50000,
      "_source" : ['id', 'created_time', 'location', 'sims'],
      "sort"    : [
        {
          "created_time": { "order": "asc" }
        }
      ],
      "query": {
        "range": {
          "created_time": {
            "from" : start_date,
            "to"   : end_date
            // "from" : + new Date('2015-04-25') / 1000,
            // "to"   : + new Date('2015-04-26') / 1000
          }
        }
      }
    }
    
    this.event_client.search({
        index : 'events',
        // type  : this.scrape_name,
        type : 'hajj_wide',
        body  : query
    }).then(function(response) {
        console.log('load_ned :: got response');
        _.map(response.hits.hits, function(x) {
            _this.ned.update({
                'target'       : x['_source']['id'],
                'created_time' : x['_source']['created_time'],
                'location'     : x['_source']['location'],
                'cands'        : x['_source']['sims']
            })
        });
        
        cb({ 'events' : _this.ned.summarize() });
    });
}

Giver.prototype.url_from_id = function(id, cb) {
    
    var query = {
        "_source" : ["images.low_resolution.url", "location"],
        "query"   : {  "match" : { "id" : id } }
    }
    
    this.client.search({
        index : this.index,
        type  : this.scrape_name,
        body  : query
    }).then(function(response) {
        var hit = response.hits.hits[0];
        cb({
            'loc' : {
                'lat' : hit._source.location.latitude,
                'lon' : hit._source.location.longitude,
            },
            'img_url' : hit._source.images.low_resolution.url,
            'id'      : hit._source.id,
        });
    });
}

// >>

Giver.prototype.get_scrape = function(scrape_name, cb) {
	var query = {
		// "size" : 0,
		"aggs" : {
			"geo_bounds" : {
				"geo_bounds" : {
					"field" : "geoloc"
				}				
			},
			"temp_bounds" : {
				"stats" : {
					"field"	: "created_time"
				}
			}
		}
	}

	this.client.search({
		index      : this.index,
		type       : scrape_name,
		body       : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		cb({
			"scrape_name" : scrape_name,
			"geo_bounds"  : response.aggregations.geo_bounds.bounds,
			"temp_bounds" : {
				"start_date" : response.aggregations.temp_bounds.min_as_string,
				"end_date"   : response.aggregations.temp_bounds.max_as_string
			}
		});
	})
}

// Gets the parameters of a scrape and saves the state
Giver.prototype.set_scrape = function(scrape_name, cb) {
	var _this = this;
	
	this.get_scrape(scrape_name, function(response) {
		
		_this.scrape_name = scrape_name;	
		// Set parameters
		_this.geo_bounds = response.geo_bounds;
		
		_this.set_temp_bounds({
			"start_date" : new Date(response.temp_bounds.start_date),
			"end_date"   : new Date(response.temp_bounds.end_date)
		});
		
		cb(response)

	});
}
// </set-scrape>

// <runners>
Giver.prototype.start = function() {
	var _this = this;
	if(this.scrape_name) {
		this.running  = true;
		this._process = this.give();		
	} else {
		console.log('!!! no scrape set yet !!!')
	}
}

Giver.prototype.stop = function() {
	console.log('stopping giver...')
	this.running = false;
	clearInterval(this._process);
	this._process = undefined;
}

Giver.prototype.restart = function() {
	this.stop();
	this.start();
}

Giver.prototype.go_live = function() {
	this.live            = true;
	this.interval        = 'second';
	this.every_interval  = 10;
	this._speed          = 10000;
	this.current_date    = new Date( (new Date)*1 - 1000*300 );
	this.restart();
}

Giver.prototype._next_period = function() {
	this.current_date = helpers.dateAdd(this.current_date, this.interval, this.every_interval);
	return this.current_date;
}
// </runners>

// giving function
Giver.prototype.give = function() {
	var _this = this;
	
	return setInterval(function() {
		
		if(_this.running) {
			_this._next_period();
			console.log('giver.give :: ', _this.current_date);
			_this.get_data(function(data) {
				_this.socket.emit('give', data)	
			});
		}
		
		if(_this.current_date.getTime() >= _this.temp_bounds.end_date.getTime()) {
			
			if(!_this.live) {
				_this.stop();
			} else {
				console.log('giver.give (live) :: further along in time than most recent record!');		
			}
			
		}
		
	}, _this._speed);
}


// Data for range
Giver.prototype.get_data = function(cb) {
	var _this = this;
	
	async.parallel([
		_this.live_ts_data.bind(_this),
		_this.live_grid_data.bind(_this),
		_this.live_image_data.bind(_this),
		_this.live_event_data.bind(_this)
		// _this.live_trending.bind(_this)
	], function (err, results) {
		// Combine results
		var out = _.reduce(results, function(a, b) {return _.extend(a, b)}, {})
		out['current_date'] = _this.current_date;
		cb(out)
	});		
}

// <setters>
// Dates that the giver is iterating over
Giver.prototype.set_temp_bounds = function(temp_bounds) {
	this.stop();
	this.temp_bounds  = temp_bounds;
	this.current_date = temp_bounds.start_date;
	return true;
}

// Time resolution of giver
Giver.prototype.set_interval = function(interval) {
	this.stop();
	this.interval = interval;
	return true;
}
// </setters>

// <live-data>
Giver.prototype.live_grid_data = function(cb) {
	// Show images from past trailing interval -- this way, if we're polling
	// every second, the heatmap remains meaningful
	var start_date = helpers.dateAdd(this.current_date, this.interval, -this.trailing_interval) // Over trailing
	var end_date   = this.current_date;
	this.get_grid_data(start_date, end_date, cb)
}

Giver.prototype.live_image_data = function(cb) {
	// Only show images since last poll
	
	var start_date = helpers.dateAdd(this.current_date, this.interval, -this.every_interval) // Since last poll
	var end_date   = this.current_date;
	this.get_image_data(start_date, end_date, cb)
}

Giver.prototype.live_event_data = function(cb) {
	// Only show images since last poll
	
	var start_date = helpers.dateAdd(this.current_date, this.interval, -this.every_interval) // Since last poll
	var end_date   = this.current_date;
	this.get_event_data(start_date, end_date, cb)
}

Giver.prototype.live_ts_data = function(cb) {
	// This one is a little tricker -- I think we want to take the floor
	// of the current time interval, and show the count since then increasing
	// on the d3 plot, then "commit" that count at the end of the interval and take
	// one step forward on the x-axis.  The committing is done on the client by checking
	// to see if the "full_unit" flag is set.

	var start_date = helpers.dateAdd(this.current_date, this.interval, -this.every_interval);
	var end_date   = this.current_date 
	//var start_date = moment(+this.current_date - (+this.every_interval)).startOf(this.interval).toDate() 
	var full_unit  = (+ moment(this.current_date).startOf(this.interval).toDate()) == (+ this.current_date)
	this.get_ts_data(start_date, end_date, full_unit, cb)
}

Giver.prototype.live_trending = function(cb) {
	this.get_trending(cb)
}
//</live-data>


// Top users up through the end of this time period
// Note that this recomputes the users every time, which is inefficient
Giver.prototype.get_trending = function(cb) {
	var _this = this;
	
	const INTERVAL = "hour";
	
	var query = {
		"query" : {
			"range" : {
				"created_time" : {
					"lte" : _this.current_date
				}
			}
		},
		"aggs" : {
			"users" : {
				"terms" : {
					"field"        : "user.username",
					"size"         : 5,
					"collect_mode" : "breadth_first"
				},
				"aggs" : {
					"timeseries" : {
						"date_histogram" : {
							"field" : "created_time",
							// "interval" : this.interval
							"interval" : INTERVAL // HARDCODING TO DAY INTERVAL FOR NOW
						}
					}
				}
			},
			"tags" : {
				"terms" : {
					"field"        : "tags",
					"size"         : 5,
					"collect_mode" : "breadth_first"
				},
				"aggs" : {
					"timeseries" : {
						"date_histogram" : {
							"field" : "created_time",
							// "interval" : this.interval
							"interval" : INTERVAL // HARDCODING TO DAY INTERVAL FOR NOW
						}
					}
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		cb(null, {
			'users' : terms_timeseries(response.aggregations.users.buckets),
			'tags'  : terms_timeseries(response.aggregations.tags.buckets)
		});
	});
}

Giver.prototype.get_ts_data = function(start_date, end_date, full_unit, cb) {
	
	var _this = this;
	var query = {
		"_source" : ['created_time'],
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : start_date,
					"lte" : end_date
				}
			}
		}
	}
    
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		cb(null, {
			"count"     : response.hits.total, 
			"date"      : end_date, 
			"full_unit" : full_unit
		});
	});
	
}

Giver.prototype.get_event_data = function(start_date, end_date, cb) {
	var _this = this;
	var query = {
		"size"  : this._max_images,
		"query" : {
			"range" : {
				"datetime" : {
					"gte" : start_date,
					"lte" : end_date
				}
			}
		}
	}
	
	this.client.search({
		index : "instagram_events_j_final",
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		var out = _.chain(response.hits.hits).map(function(hit) {
			return {
				'event' : hit._source
				/*
				'img_url' : hit._source.images.low_resolution.url,
				'id'      : hit._source.id,
				'link'    : hit._source.link,
				'user'    : hit._source.user.username,
				'user_id' : hit._source.user.id
				*/
			}
		}).value()
		cb(null, {'events' : out});
	});
}

Giver.prototype.get_image_data = function(start_date, end_date, cb) {
	var _this = this;
	var query = {
		"size"  : this._max_images,
		"query" : {
			"range" : {
				"created_time" : {
					"gte" : start_date,
					"lte" : end_date
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		var out = _.chain(response.hits.hits).map(function(hit) {
			return {
				'loc' : {
					'lat' : hit._source.location.latitude,
					'lon' : hit._source.location.longitude,
				},
				'img_url' : hit._source.images.low_resolution.url,
				'id'      : hit._source.id,
				'link'    : hit._source.link,
				'user'    : hit._source.user.username,
				'user_id' : hit._source.user.id
			}
		}).value()
		cb(null, {'images' : out});
	});
}

Giver.prototype.get_image_data_slice = function(start_date, end_date, area, cb) {
	var _this = this;

	if(area._southWest) {
		area = helpers.leaflet2elasticsearch(area)
	}
    
	var query = {
		"size"  : 4000,
		"query" : {
			"filtered": {
				"query": {
					"range" : {
						"created_time" : {
							"gte" : start_date,
							"lte" : end_date
						}
					}
				},
				"filter": {
					"geo_bounding_box": {
						"geoloc": area
					}
				}
			}
		}
	};
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query
	}).then(function(response) {
		var out = _.chain(response.hits.hits).map(function(hit) {
			return {
				'loc' : {
					'lat' : hit._source.location.latitude,
					'lon' : hit._source.location.longitude,
				},
				'img_url' : hit._source.images.low_resolution.url,
				'id'      : hit._source.id,
				'link'    : hit._source.link,
				'user'    : hit._source.user.username,
				'user_id' : hit._source.user.id
			}
		}).value()
		cb({'images' : out});
	});
}

Giver.prototype.get_grid_data = function(start_date, end_date, cb, area) {
	
	if(!area) {
		area = this.geo_bounds;
	}
	
	var query = {
		// "size" : 0,
		"query": {
			"filtered": {
				"query" : {
					"range" : {
						"created_time" : {
							"gte" : start_date,
							"lte" : end_date
						}
					}
				},
				"filter": {
					"geo_bounding_box": {
						"geoloc": area
					}
				}
			}
		},
		"aggs": {
			"locs": {
				"geohash_grid": {
					"field"     : "geoloc",
					"precision" : this.grid_precision,
					"size"      : 10000
				}
			}
		}
	}
	
	this.client.search({
		index : this.index,
		type  : this.scrape_name,
		body  : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		var buckets = response.aggregations.locs.buckets;
		var out     = _.map(buckets, function(x) { return helpers.geohash2geojson(x['key'], {'count' : x['doc_count']}); })
		cb(null, {'grid' : {"type" : "FeatureCollection", "features" : out}});
	});
}

// All of the data from a given area, since the beginning of time
Giver.prototype.analyze_area = function(params, cb) {
	var _this = this;
	
    if(params.area) {
        if(params.area._southWest) {
            params.area = helpers.leaflet2elasticsearch(params.area)
        }
    }
    
    async.parallel([
        _this.analyze_ts_data.bind(_this, params),
        // _this.analyze_grid_data.bind(_this, area)
    ], function (err, results) {
        cb(
            _.reduce(results, function(a, b) {return _.extend(a, b)}, {})
        )
    })        
}

Giver.prototype.analyze_grid_data = function(area, cb) {
	var start_date = this.temp_bounds.start_date;
	var end_date   = this.temp_bounds.end_date;
	this.get_grid_data(start_date, end_date, cb, area);
}

Giver.prototype.analyze_ts_data = function(params, cb) {
	
    var query, interval;
    if(params.area) {
        interval = 'day'
        query = {
            // "size" : 0,
            "query": {
                "filtered": {
                    "query" : {
                        "range" : {
                            "created_time" : {
                                "gte" : this.temp_bounds.start_date,
                                "lte" : this.temp_bounds.end_date
                            }
                        }
                    },
                    "filter": {
                        "geo_bounding_box": {
                            "geoloc" : params.area
                        }
                    }
                }
            }
        }        
    } else {
        interval = 'hour'
        query = {
            "query" : {
                "terms" : {
                    "id" : this.ned.cluster_to_id[params.cluster_id]
                }
            }
        }
    }
    
    query['aggs'] = {
        "timeseries" : {
            "date_histogram" : {
                "field"    : "created_time",
                "interval" : interval
            }
        }
    }
    
	this.client.search({
		index      : this.index,
		type       : this.scrape_name,
		body       : query,
        searchType : "count",
        queryCache : true
	}).then(function(response) {
		var timeseries = _(response.aggregations.timeseries.buckets)
    		.map(function(x) {
    			return {
    				'count' : x['doc_count'],
    				'date'  : x['key_as_string']
    			}
    		});
		
        console.log(timeseries);
		cb(null, {'timeseries' : timeseries});
	});
}

// ---- Processing functions ----
function terms_timeseries(x) {
	return _.map(x, function(b) {
		return {
			"key" : b.key,
			"timeseries" : _.map(b.timeseries.buckets, function(x) {
				return {
					'count' : x['doc_count'],
					'date'  : x['key_as_string']
				}
			})
		}
	});
}

// ---- Helper functions -----

module.exports = Giver;