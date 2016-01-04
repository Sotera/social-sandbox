var request = require('request'),
con = require('../config'),
path = require('path');
module.exports = function(server) {
  // Install a `/` route that returns server status
  var router = server.loopback.Router();

  router.get('/', function(req,res){
    router.requestTokenFromInstagram(req.query.code, res);
  });

  router.get('/go', function(req,res){
    res.sendFile(path.join(__dirname + '../../../client/app/index.html'));
  });

  router.requestTokenFromInstagram = function(coded, res) {
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
        function(err,httpResponse,body) {
          var access_token = con.instagram_access_token;//JSON.parse(body).access_token;
          console.log('User Token: ' + access_token);
          res.cookie('justin',access_token, { maxAge: 900000, httpOnly: false });
          res.redirect('/go');
        }
    );
  };

  server.use(router);
};
