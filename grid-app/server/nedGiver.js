var _      = require('underscore')._,
    async  = require('async'),
    moment = require('moment');

var helpers          = require('./helpers');
var NewEventDetector = require('./events');

function nedGiver(client, socket, index) {
    
    this.ned = new NewEventDetector();

    this.index       = 'event';
    this.scrape_name = 'sims';
    
    this.client = client;
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
    this.trailing_interval = 1;        
    this.every_interval    = 1;  
    
    this.grid_precision = 6;
    this.geo_bounds     = undefined
    
    this.live     = false;
    this.running  = false;  
    
    // Private variables
    this._speed      = 100; // Speed of playback (in milliseconds)
    this._process    = undefined;
    this._max_images = 10;
}

// <runners>
nedGiver.prototype.start = function() {
    var _this = this;
    if(this.scrape_name) {
        console.log('starting nedGiver...')
        this.running  = true;
        this._process = this.give();        
    } else {
        console.log('!!! no scrape set yet !!!')
    }
}

nedGiver.prototype.stop = function() {
    console.log('stopping nedGiver...')
    this.running = false;
    clearInterval(this._process);
    this._process = undefined;
}

nedGiver.prototype.restart = function() {
    this.stop();
    this.start();
}

nedGiver.prototype.go_live = function() {
    this.live = true;
    this.restart();
}

nedGiver.prototype._next_period = function() {
    this.current_date = helpers.dateAdd(this.current_date, this.interval, this.every_interval);
    return this.current_date;
}
// </runners>

// giving function
nedGiver.prototype.give = function() {
    var _this = this;
    
    return setInterval(function() {
        
        if(_this.running) {
            _this._next_period();
            _this.get_data(function(data) {
                console.log(_this.current_date)
                _this.socket.emit('ned-give', data) 
            });
        }
        
    }, _this._speed);
}


// Data playback
nedGiver.prototype.get_data = function(cb) {
    var _this = this;
    async.parallel([
        _this.live_cc.bind(_this)
    ], function (err, results) {
        cb({
            'current_date' : _this.current_date,
            'events'       : _this.ned.summarize()
        })
    });
}

// <setters>
// Dates that the giver is iterating over
nedGiver.prototype.set_temp_bounds = function(temp_bounds) {
    this.stop();
    this.temp_bounds  = temp_bounds;
    this.current_date = temp_bounds.start_date;
    return true;
}

// Time resolution of giver
nedGiver.prototype.set_interval = function(interval) {
    this.stop();
    this.interval = interval;
    return true;
}
// </setters>

// <live-data>
nedGiver.prototype.live_cc = function(cb) {
    // Show images from past trailing interval -- this way, if we're polling
    // every second, the heatmap remains meaningful
    var start_date = helpers.dateAdd(this.current_date, this.interval, -this.trailing_interval) // Over trailing
    var end_date   = this.current_date;
    this.get_cc(start_date, end_date, cb)
}

nedGiver.prototype.get_cc = function(start_date, end_date, cb) {
    var _this = this;
    
    var query = {
        "size" : 9999,
        "sort" : [
            { "created_time" : { "order" : "asc" } }
        ],
        "query": {
            "filtered": {
                "query" : {
                    "range" : {
                        "created_time" : {
                            "gte" : + start_date,
                            "lte" : + end_date
                        }
                    }
                }
            }
        }
    }
    
    this.client.search({
        index      : this.index,
        type       : this.scrape_name,
        body       : query
    }).then(function(response) {
        _.map(response.hits.hits, function(x) {
            _this.ned.update({
                'target'       : x['_source']['id'],
                'created_time' : x['_source']['created_time'],
                'location'     : x['_source']['location'],
                'cands'        : _.chain(x['_source']['sims']).pluck('id').value(),
            })
        });
                
        cb(null, {'n' : response.hits.total});
    });
}

// ---- Helper functions -----

module.exports = nedGiver
