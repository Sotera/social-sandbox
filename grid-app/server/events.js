var _ = require('underscore')._;

function Events() {
    this.thresh            = 0;
    this.n                 = 0;
    this.cluster_summaries = {};
    this.id_to_cluster     = {};
    this.cluster_to_id     = {};
}

Events.prototype.reset = function() {
    this.n                 = 0;
    this.cluster_summaries = {};
    this.id_to_cluster     = {};
    this.cluster_to_id     = {};    
}

Events.prototype.update_id_to_cluster = function(cluster_id) {
    _.map(this.cluster_to_id[cluster_id], function(id) {
        this.id_to_cluster[id] = this.n;
    }.bind(this));
}

Events.prototype.update_cluster_to_id = function(cluster_id) {
    this.cluster_to_id[this.n] = this.cluster_to_id[this.n].concat(this.cluster_to_id[cluster_id]);
    delete this.cluster_to_id[cluster_id]
}

// BUG -- these counts are wrong because I'm overwriting this.cluster_summaries[this.n]
Events.prototype.update_cluster_summaries = function(cluster_id) {

    var x    = this.cluster_summaries[this.n];
    var prev = this.cluster_summaries[cluster_id];
    if(prev) {
        this.cluster_summaries[this.n] = {
            'id'    : this.n,
            'count' : prev['count'] + x['count'],
            'location'     : {
                'lat' : {
                    'min' :  _.min([x['location']['lat']['min'], prev['location']['lat']['min']]),
                    'max' : _.max([x['location']['lat']['max'], prev['location']['lat']['max']]),
                },
                'lon' : {
                    'min' : _.min([x['location']['lon']['min'], prev['location']['lon']['min']]),
                    'max' : _.max([x['location']['lon']['max'], prev['location']['lon']['max']]),
                }
            },
            'created_time' : {
                'min' : _.min([x['created_time']['min'], prev['created_time']['min']]),
                'max' : _.max([x['created_time']['max'], prev['created_time']['max']]),
            }
        }
    }
    delete this.cluster_summaries[cluster_id];
}

Events.prototype.init_cluster_summary = function(x) {
    this.cluster_summaries[this.n] = {
        'id'    : this.n,
        'count' : 1,
        'location'     : {
            'lat' : {
                'min' : x['location']['latitude'],
                'max' : x['location']['latitude'],
            },
            'lon' : {
                'min' : x['location']['longitude'],
                'max' : x['location']['longitude'],
            }
        },
        'created_time' : {
            'min' : x['created_time'],
            'max' : x['created_time'],
        }
    }
}

Events.prototype.update = function(x) {
    var _this = this;
    
    var source  = x['target'];
    var targets = _.chain(x['cands'])
        .filter(function(x) {return x.sim > _this.thresh})
        .pluck('id')
        .filter(function(x) {return x != source})
        .value();
    
    this.id_to_cluster[source] = this.n;
    this.cluster_to_id[this.n] = [source]
    this.init_cluster_summary(x);
    
    var neib_clusters = _.chain(targets).map(function(t) {return _this.id_to_cluster[t]}).filter().uniq().value();
    _.map(neib_clusters, function(c) {        
        this.update_id_to_cluster(c);
        this.update_cluster_to_id(c);
        this.update_cluster_summaries(c);
    }.bind(this));
    
    this.n = this.n + 1;
}

Events.prototype.summarize = function() {    
    const MIN_COUNT = 10;
    
    var max_time = _.chain(this.cluster_summaries).map(function(x) {return x.created_time.max}).max().value();
    var min_time = _.chain(this.cluster_summaries).map(function(x) {return x.created_time.min}).min().value();
    
    
    return _.chain(this.cluster_summaries)
        .map(function(x) {
            return _.extend(x, {
                "created_time_norm" : {
                    "min" : (x['created_time']['min'] - min_time) / (max_time - min_time),
                    "max" : (x['created_time']['max'] - min_time) / (max_time - min_time),
                } 
            });
        })
        .filter(function(x) {return x.count > MIN_COUNT})
        .sortBy(function(x) {return x.count})
        .value()
}

Events.prototype.set_detail = function(detail_data) {
    this.detail_data = detail_data;
}

// BUG :: Not adding nodes that don't have edges pointing out of them.
Events.prototype.make_graph = function() {
    return {
        "nodes" : _.map(this.detail_data, function(x) {
            return {
                'id'   : x.id,
                'lat'  : x.location.latitude,
                'lon'  : x.location.longitude,
                'time' : x.created_time
            }
        }),
        "links" : _.flatten(_.map(this.detail_data, function(x) {
            return _.map(x.sims, function(e) {
                return {
                    'source' : x.id,
                    'target' : e.id,
                    'sim'    : e.sim
                }
            });
        }))
    }
}

module.exports = Events;