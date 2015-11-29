
module.exports = function(app, server, client, config) {
  var io       = require('socket.io').listen(server, { log : false }),
      _        = require('underscore'),
      request  = require('request'),
      es       = require('elasticsearch');

  var config   = require('./config'),
      Giver    = require('./giver');
      //NedGiver = require('./nedGiver');


  const WHITELIST = ['missou','paris','test','hajj', 'yale','cuba','yangon','london','amman','caracas','charleston','boston', 'ukraine', 'southkorea', 'cleveland', 'baltimore', 'isil', 'ny', 'dc', 'waitwhat', 'russia', 'la'];
  
  io.sockets.on('connection', function(socket) {
        
    // Giver
    var giver = new Giver(client, socket, config.es_index);
    // giver.set_temp_bounds({"start_date" : new Date('2015-04-01'), "end_date" : new Date('2015-04-30')});
    
    socket.on('stop_giver',  function(cb) { giver.stop(); cb(); });
    socket.on('start_giver', function(cb) { giver.start(); cb(); });
    socket.on('realtime',    function(cb) { giver.go_live(); cb(); });

    socket.on('load_time', function(current_scrape_name, starttime, endtime, geo_bounds, callback) {
        giver.get_image_data_slice(new Date(starttime * 1000), new Date(endtime * 1000), geo_bounds, function(response) {
          callback(response);
        });
    });
    
    // Initiating scraping
    socket.on('init_scrape', function(data, callback) {
      console.log('initating scrape :: ', data);
      request( {
        url     : "http://localhost:3000/scrape",
        method  : "POST",
        json    : true,
        headers : {
            "content-type": "application/json",
        },
        body : data
      });
      
      callback({'status' : 'ok'});
    })
    
    // List of existing scrape
    socket.on('get_existing', function(callback) {
      console.log('get_existing :: ');
      
      client.indices.getMapping({
        index : config['index'],
        type  : WHITELIST
      }).then(function(response) {
        callback({
          'types' : _(response['instagram_remap'].mappings)
            .keys()
            .filter(function(d) {
              return _.contains(WHITELIST, d)
            })
        });
      });
    });
    
    // Choosing an existing scrape
    socket.on('set_scrape', function(scrape_name, callback) {
      console.log('set_scrape :: ', scrape_name);
      giver.set_scrape(scrape_name, function(scrape) {
        
        // Send information about scrape back to front end
        callback(scrape);
        
        // Start the scrape playback
        //giver.start();
      });
    });
    
    socket.on('load_scrape', function(scrape_name, callback) {
        console.log('load_scrape :: ', scrape_name);
        giver.get_scrape(scrape_name, function(scrape) {
            callback(scrape);
        });
    });

    socket.on('load_events', function(scrape_name, callback) {
        console.log('load_events :: ', scrape_name);
        giver.get_events(scrape_name, function(events) {
            callback(events);
        });
    });
    
    // <<
    
    socket.on('load_ned', function(start_date, end_date, callback) {
        console.log('load_ned :: ', start_date, end_date);
        giver.load_ned(start_date, end_date, function(ned) {
            callback(ned);
        });
    });

    socket.on('show_ned', function(cluster, callback) {
        console.log('show_ned :: ', cluster);
        giver.show_ned(cluster, function(ned_detail) {
            callback(ned_detail);
        });
    });

    socket.on('show_ned_images', function(cluster, callback) {
        console.log('show_ned_images :: ', cluster);
        giver.show_ned_images(cluster, function(ned_detail) {
            callback(ned_detail);
        });
    });

    socket.on('url_from_id', function(id, callback) {
        console.log('url_from_id :: ', id);
        giver.url_from_id(id, function(d) {
            callback(d);
        });
    });
    // >>

    socket.on('analyze_area', function(params, callback) {
        console.log('params :: ', params);
        giver.analyze_area(params, function(response) {
            callback(response)
        });
    });

    socket.on('disconnect', function(){
      giver.stop();
    });

    socket.on('scrape_user', function(user, callback){
      console.log(user);
      console.log("https://api.instagram.com/v1/users/" + user + "/media/recent?access_token=" + config.instagram_access_token);

        request( {
          url: "https://api.instagram.com/v1/users/" + user + "/media/recent?access_token=" + config.instagram_access_token,
          method: "GET",
          json: true,
          headers: {
              "content-type": "application/json",
          }
        }, function optionalCallback(err, httpResponse, body) {
              callback(body);
           }
        );
    });

    // Initiating scraping
    socket.on('alert_user', function(data, callback) {
      console.log('alerting user :: ', data);
      data['access_token'] = config.instagram_access_token;
      var im = data.image;
      delete data.image;
      request.post({url:"https://api.instagram.com/v1/media/" + im + "/comments", 
        form: {access_token:data['access_token'], text:'test'}}, 
        function(err,httpResponse,body) { /* ... */ 
        });
    });
    
  });
}
