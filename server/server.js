var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');

// Dependencies
var es = require('elasticsearch'),
    fs = require('fs'),
    _  = require('underscore')._,
    cookieParser = require('cookie-parser');

//stand-in so we dont crash right away
var con = {
    instagram_key : "put your client id here",
    stagram_client_secret : "put your client secret here",
    instagram_access_token : "put your token here",
    es_index : 'instagram_remap'
};

if(fs.existsSync('./server/config.js')) {
    con = require('./config');
}
else{
    console.log("Please copy /server/config.template.js to /server/config.js and edit the values.")
}

var redisAddr = process.env.REDIS_PORT_6379_TCP_ADDR||"localhost";
var redisPort = process.env.REDIS_PORT_6379_TCP_PORT||"6379";
var esAddr = process.env.ELASTICSEARCH_PORT_9200_TCP_ADDR||config.es_address;
var esPort = process.env.ELASTICSEARCH_PORT_9200_TCP_PORT||config.es_port;
var esUrl = 'http://'+esAddr+':'+esPort;
var request = require('request');



con.rootDir = path.resolve('~','../');


var app = module.exports = loopback();

app.start = function() {

    var staticPath = null;

    staticPath = path.resolve(__dirname, '../client/app/');
    console.log("Running app in development mode");

    app.use(loopback.static(staticPath));

    app.use(cookieParser());
    // set a cookie


    app.get('/login',function(req,res){
        res.redirect('http://api.instagram.com/oauth/authorize/?client_id=' + con.instagram_key + '&redirect_uri=http://localhost:3000/&response_type=code');

    });

    // kill all spawned python processes
    app.stop_scrapes = function() {
        var spawn = require('child_process').spawn;
        var child = spawn('pkill', ['python'],
            {
                detached: true,
                stdio: 'ignore'
            }
        );
        child.unref();
    }

    app.scrape = function(data) {
        console.log("/scrape starting scrape...");
        var min_lat = data.leaflet_bounds._southWest.lat;
        var min_lon = data.leaflet_bounds._southWest.lng;
        var max_lat = data.leaflet_bounds._northEast.lat;
        var max_lon = data.leaflet_bounds._northEast.lng;

        var scrapeName     = data.name;
        var date    = data.time.replace(/-/g,'') + '00';
        var end_date    = null;
        if(data.end_time)
            end_date= data.end_time.replace(/-/g,'') + '00';

        var spawn = require('child_process').spawn;

        console.log("Going on it..." + data.key);
        console.log("output to : " + con.rootDir);
        if (!fs.existsSync(con.rootDir  + '/' + scrapeName)) {
            fs.mkdirSync(con.rootDir  + '/' + scrapeName);
        }
        if (!fs.existsSync(con.rootDir + '/' + scrapeName + '/' + scrapeName + '_images')) {
            fs.mkdirSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '_images');
        }
        if (!fs.existsSync(con.rootDir + '/' + scrapeName + '/' + scrapeName + '_meta')) {
            fs.mkdirSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '_meta');
        }

        var out = fs.openSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '.log', 'a'),
            err = fs.openSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '.log', 'a'),
            feat_out = fs.openSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '_feats.log', 'a');
        event_out = fs.openSync(con.rootDir  + '/' + scrapeName + '/' + scrapeName + '_events.log', 'a');

        var options = ['python', con.rootDir +'/python/realtimegeo.py',  '-key', data.key,
            '-start_date', date, '-rootDir', con.rootDir , '-bb',
            [min_lat,min_lon,max_lat,max_lon].join(','), '-es', esUrl, '-es_index', con.es_index,
            '-scrape_name', scrapeName, '--save_images'];
        if(end_date){
            options.push('-end_date');
            options.push(end_date);
        }
        var child = spawn('nohup',options,
            {
                detached: true,
                stdio: [ 'ignore', out, err ]
            }
        );
        child.unref();


        var featurizer = spawn('nohup',['python', con.rootDir + '/python/ss-ned/ss-image-featurize.py', '-rootDir',
                con.rootDir,  '-scrape_name', scrapeName, '-redis_address', redisAddr, '-redis_port', redisPort ],
            {
                detached: true,
                stdio: [ 'ignore', feat_out, feat_out ]
            }
        );
        featurizer.unref();

         var ner_streamer = spawn('nohup',['python', con.rootDir + '/python/ss-ned/ned_streamer_example.py', '-rootDir',
         con.rootDir, '-scrape_name', scrapeName, '-es', esUrl, '-es_index', con.es_index, '-redis_address',
         redisAddr, '-redis_port', redisPort],
         {
         detached: true,
         stdio: [ 'ignore', event_out, event_out ]
         }
         );
         ner_streamer.unref();
    };


    // Requests that get this far won't be handled
    // by any middleware. Convert them into a 404 error
    // that will be handled later down the chain.
    app.use(loopback.urlNotFound());

    // The ultimate error handler.
    app.use(loopback.errorHandler());

    // start the web server
    return app.listen(function() {
        app.emit('started');
        var baseUrl = app.get('url').replace(/\/$/, '');
        console.log('Web server listening at: %s', baseUrl);
        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;
            console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
        }
    });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
    if (err) throw err;

    // start the server if `$ node server.js`
    if (require.main === module) {
        var server = app.start();
        var client = new es.Client({hosts : [esUrl]});
        console.log("Elasticsearch Url = " + esUrl);
        require('./socket')(app, server, client, con);
    }
});

/////////////////////////









