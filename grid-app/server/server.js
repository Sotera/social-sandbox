
// Dependencies
var es = require('elasticsearch'),
	_  = require('underscore')._;

// Express server
var express = require('express'),
    app     = express();
     server = require('http').createServer(app);

var request = require('request');

var con = require('./config');

var fs = require('fs');

app.use(require('body-parser').json());

var coded;

var access_token = "nothing";

var i = 0;

function goguy(err,httpResponse,body){
  access_token = JSON.parse(body).access_token; 
  console.log('this is it ' + access_token); 
}
    
// Headers
app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-Access-Token, Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, GET, DELETE');
    res.header('X-Content-Type-Options', 'nosniff');
    next();
    coded = req.query.code;
    console.log("getting here....hmmm...");
    if (i == 0 || coded ) {
      console.log("should only do this once");
    request.post({url:'https://api.instagram.com/oauth/access_token', 
      form: {client_id:con.instagram_key,
client_secret:con.instagram_client_secret,
grant_type:'authorization_code',
redirect_uri:'http://localhost:3000/',
code:coded
}}, 
    goguy);
  }
  i++;
});
        
// Static content (needs to be before authentication, otherwise it'll get blocked)
app.use('/', express.static('../web'));

app.post('/scrape', function(req, res) {

    var min_lat = req.body.leaflet_bounds._southWest.lat;
    var min_lon = req.body.leaflet_bounds._southWest.lng;
    var max_lat = req.body.leaflet_bounds._northEast.lat;
    var max_lon = req.body.leaflet_bounds._northEast.lng;
    var idx = req.body.name;
    var date = req.body.time.replace(/-/g,'') + '00'

    var spawn = require('child_process').spawn;

    var out = fs.openSync('./out.log', 'a'),
        err = fs.openSync('./out.log', 'a');

    console.log("Going on it..." + access_token);

    var child = spawn('nohup',['python', '../../python/realtimegeo.py',  '-key', access_token, 
      '-start_date', date,  '-bb', [min_lat,min_lon,max_lat,max_lon].join(','), '-es', 
    con.es_path, '-es_index', idx],
      {
        detached: true,
        stdio: [ 'ignore', out, err ]
      }
     );

    child.unref();

    res.send({"sweet":"ok"});
});

    
// Setup routes
var config = {
	'es_path' : con.es_path,
	'index'   : con.es_index
};

var client = new es.Client({hosts : [config.es_path]});

// require('./routes.js')(app, client, config);
require('./socket.js')(app, server, client, config);

server.listen(3000, function() {
  console.log("Started a server on port 3000");
});
