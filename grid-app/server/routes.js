// module.exports = function(app, client, config) {

//     var _        = require('underscore')._;
//    	var ngeohash = require('ngeohash');
   	
//     // app.post('/get_grid', function(req, res) {
//     //     var d = req.body;
        
//     //     res.send({
//     //         'hashes' : ngeohash.bboxes(d.bottom_right.lat, d.bottom_rightlon, d.top_left.lat, d.top_left.lon)
//     //     })
//     // })
    
//     // app.post('/get_data', function(req, res) {

//     // 	client.search({
//     // 		index : config['index'],
//     // 		type  : config['type'],
//     // 		searchType : 'count',
//     // 		body  : {
//     // 			"query": {
//     // 				"filtered": {
//     // 					"filter": {
//     // 						"geo_bounding_box": {
//     // 							"gfloc": {
//     // 								"top_left": {
//     // 									"lat": 39.3833 ,
//     // 									"lon":  -76.71669999999999
//     // 								},
//     // 								"bottom_right": {
//     // 									"lat": 39.183299999999996,
//     // 									"lon": -76.5167
//     // 								}
//     // 							}
//     // 						}
//     // 					}
//     // 				}
//     // 			},
//     // 			"aggs": {
//     // 				"locs": {
//     // 					"geohash_grid": {
//     // 						"field"     : "gfloc",
//     // 						"precision" : 7,
//     // 						"size"      : 10000
//     // 					},
//     // 					"aggs" : {
//     // 						"time" : {
//     // 							"date_histogram" : {
//     // 								"field"    : "gftime",
//     // 								"interval" : "day"
//     // 							}
//     // 						}
//     // 					}
//     // 				}
//     // 			}
//     // 		}
//     // 	}).then(function(response) {
//     // 		var buckets = response['aggregations']['locs']['buckets'];

//     // 		// This has to go first
//     // 		var utimes = _.unique(_.flatten(_.map(buckets, function(x) {
//     // 			return _.pluck(x['time']['buckets'], 'key')
//     // 		})))
//     // 		utimes.sort()
    		
//     // 		var data = _.map(buckets, function(x) {
//     // 			var pos = ngeohash.decode_bbox(x['key']);
//     // 			x['pos']  = [{'y' : pos[2], 'x' : pos[1]}, {'y' : pos[0], 'x' : pos[3]}]
//     // 			x['time'] = x['time']['buckets']
//     // 			return x
//     // 		})
    		
//     // 		res.send({'data' : data, 'utimes' : utimes})
//     // 	})
//     // });
// }



