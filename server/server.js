
// Dependencies
var es = require('elasticsearch'),
    fs = require('fs'),
	_  = require('underscore')._,
  cookieParser = require('cookie-parser');


// Express server
var express = require('express'),
        app = express(),
     server = require('http').createServer(app);

var request = require('request');

var con = require('./config');

app.use(require('body-parser').json());

var coded = "",
    myres = "";

function grabUserToken(err,httpResponse,body) {
  var access_token = con.instagram_access_token;//JSON.parse(body).access_token;
  console.log('User Token: ' + access_token);
  myres.cookie('justin',access_token, { maxAge: 900000, httpOnly: false });
  myres.redirect('/go');
}

function requestTokenFromInstagram(coded) {
  request.post( {
    url:'https://api.instagram.com/oauth/access_token', 
    form: {
      client_id:con.instagram_key,
      client_secret:con.instagram_client_secret,
      grant_type:'authorization_code',
      /*
        Assumes the application is hosted here.  This needs to be set exactly to what is in the instagram
        hosted configuration.
      */
      redirect_uri:'http://localhost:3000/',

      code:coded
    }
  }, 
  grabUserToken
  );
}
    
// Headers

/*
app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-Access-Token, Content-Type');
    res.header('Access-Control-Allow-Methods', 'POST, GET, DELETE');
    res.header('X-Content-Type-Options', 'nosniff');
    next();
    var temp_code = req.query.code;
    if ( temp_code != undefined ) {
      coded = req.query.code;
      requestTokenFromInstagram(coded);
    }

    if (coded == "" ) {
        console.log("should only do this once");
        requestTokenFromInstagram(coded);
  }

});
*/

app.use(cookieParser());
// set a cookie

app.use('/go',express.static(__dirname + '/../web'));

app.get('/login',function(req,res){
  res.redirect('http://api.instagram.com/oauth/authorize/?client_id=' + con.instagram_key + '&redirect_uri=http://localhost:3000/&response_type=code');
  
});

app.get('/',function(req,res){
  myres = res;
  requestTokenFromInstagram(req.query.code);

});

        
// Static content (needs to be before authentication, otherwise it'll get blocked)
//app.use('/', express.static('../web'));
//express.static('../web'));

app.post('/scrape', function(req, res) {

    var min_lat = req.body.leaflet_bounds._southWest.lat;
    var min_lon = req.body.leaflet_bounds._southWest.lng;
    var max_lat = req.body.leaflet_bounds._northEast.lat;
    var max_lon = req.body.leaflet_bounds._northEast.lng;
    
    var idx     = req.body.name;
    var date    = req.body.time.replace(/-/g,'') + '00'

    var spawn = require('child_process').spawn;

    console.log("Going on it..." + req.body.key);
    console.log("output to : " + con.rootDir);
    if (!fs.existsSync(con.rootDir  + '/' + idx)) {
        fs.mkdirSync(con.rootDir  + '/' + idx);
    }
    if (!fs.existsSync(con.rootDir + '/' + idx + '/' + idx + '_images')) {
        fs.mkdirSync(con.rootDir  + '/' + idx + '/' + idx + '_images');
    }
    if (!fs.existsSync(con.rootDir + '/' + idx + '/' + idx + '_meta')) {
        fs.mkdirSync(con.rootDir  + '/' + idx + '/' + idx + '_meta');
    }

    var out = fs.openSync(con.rootDir  + '/' + idx + '/' + idx + '.log', 'a'),
        err = fs.openSync(con.rootDir  + '/' + idx + '/' + idx + '.log', 'a'),
        feat_out = fs.openSync(con.rootDir  + '/' + idx + '/' + idx + '_feats.log', 'a');
        event_out = fs.openSync(con.rootDir  + '/' + idx + '/' + idx + '_events.log', 'a');


    var child = spawn('nohup',['python', con.rootDir +'/python/realtimegeo.py',  '-key', req.body.key,
      '-start_date', date, '-rootDir', con.rootDir , '-bb', [min_lat,min_lon,max_lat,max_lon].join(','), '-es',
    con.es_path, '-es_index', idx, '--save_images'],
      {
        detached: true,
        stdio: [ 'ignore', out, err ]
      }
     );
    child.unref();



    var featurizer = spawn('nohup',['python', con.rootDir + '/python/ss-ned/ss-image-featurize.py', '-rootDir',
            con.rootDir,  '-es_index', idx],
      {
        detached: true,
        stdio: [ 'ignore', feat_out, feat_out ]
      }
     );
    featurizer.unref();

    res.send({"sweet":"ok"});

   /* var ner_streamer = spawn('nohup',['python', con.rootDir + '/python/ss-ned/ned_streamer_example.py',  idx],
      {
        detached: true,
        stdio: [ 'ignore', event_out, event_out ]
      }
     );
    ner_streamer.unref();*/

});

    
// Setup routes
var config = {
	'es_path' : con.es_path,
	'index'   : con.es_index
};

var client = new es.Client({hosts : [config.es_path]});

// require('./routes.js')(app, client, config);
require('./socket')(app, server, client, config);

server.listen(3000, function() {
  console.log("Started a server on port 3000");
});
