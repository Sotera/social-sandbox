var express = require('express'),
        app = express(),
     server = require('http').createServer(app),
         io = require('socket.io').listen(server, { log : false }),
       path = require('path'),
          _ = require('underscore')._,
//    twitter = require('ntwitter'),
      kafka = require('kafka-node');

var config = {
  'KAFKA'      : 'localhost:2181',
  'RAW_TOPIC'  : 'throwaway',
  'PROC_TOPIC' : 'instagram_fake'
}

// Kafka consumer
var Consumer = kafka.Consumer;
    client   = new kafka.Client(config['KAFKA']),
    consumer = new Consumer( client, [ 
      { topic: config['RAW_TOPIC'] },
      { topic: config['PROC_TOPIC'] }
    ], { autoCommit: true, fetchMaxBytes: 1024 * 100000} );

// Twitter consumer
// var twit = new twitter({
//   consumer_key        : '',
//   consumer_secret     : '',
//   access_token_key    : '',
//   access_token_secret : ''
// });

var counter = 0;

io.sockets.on('connection', function(socket) {

  // Forward Kafka -> socket.io
  consumer.on('message', function (message) {
      try {
        
        if(message.topic == config['RAW_TOPIC']) {
          counter++;  
          _([message.value]).flatten()
           .map(function(x) {
              socket.emit('raw', JSON.parse(x));
           });
          
        } else if(message.topic == config['PROC_TOPIC']) {
          _([message.value]).flatten()
           .map(function(x) {
              socket.emit('proc', JSON.parse(x));
           });
           
        }
        
      } catch(e) {
        console.log('>>> cannot parse json >>> ', e);
      }
  });
  
  
  // wcloud = []
  // count  = 0;
  // dat    = []

  // twit.stream('statuses/filter', {'locations':'-78.06,38.80,-77.05,38.83'}, function(stream) {
  //   stream.on('data', function (data) {
      
  //     wc=data['text']
      
  //     var counts = data['text'].split(/\s+/).reduce(function(map, word){
  //       map[word] = (map[word]||0)+1;
  //       return map;
  //     }, Object.create(null));
  
  //     for(var key in counts){
  //       wcloud.push({"text":key,"size":counts[key]+ Math.random() * 90})
  //     }
      
  //     dat.push({'x':count,'y':Math.random()*100})
  //     if(dat.length > 50  || count == 0){
  //       dat.shift()
  //     }

  //     count++;
  //     setInterval(function(){
  //       socket.emit('twitter',{'wc':wcloud,'ts':[{'name':"Baltimore",'color':"red",'data':dat}]})
  //       wcloud=[]
  //     }, 3000)
  //   });
  // });
}); 

// io.sockets.on('connection', function(socket) {
//   var twit = twitterModule.twit;
//   twit.stream('statuses/filter', {'locations':'-80.10,26.10,-80.05,26.15'},
//     function(stream) {
//       stream.on('data',function(data){
//         socket.emit('twitter',data);
//       });
//     });
// });


// Serve static content
app.use('/', express.static(__dirname));

// Start server
server.listen(3000, function() {
  console.log("Started a server on port 3000");
});

