
var baseLayer = L.tileLayer('https://{s}.tiles.mapbox.com/v3/cwhong.map-hziyh867/{z}/{x}/{y}.png', {
  attribution : "Team Graham",
  maxZoom     : 18
});

//setup map and add layers
var map = new L.Map('map', {
  center : new L.LatLng(39.2833, -76.6167),
  zoom   : 13,
  layers : [baseLayer]
});

// Create the ping layer
var pingLayer = L.pingLayer({
    lng: function(d){ return d[0]; },
    lat: function(d){ return d[1]; },
    duration: 1000,
    efficient: {
        enabled: false,
        fps: 8
    }
}).addTo(map);
pingLayer.radiusScale().range([0, 5]);
pingLayer.opacityScale().range([1, 0]);

// Markers on the map
var cssIcon = L.divIcon({
  className : 'marker',
  iconSize  : [1, 1]
});

function addMarker(d) {
  // var marker = L.marker([d.location.latitude, d.location.longitude], {
  //   icon : cssIcon
  // })
  // marker.addTo(map);
  // $('.marker').fadeOut(10000, function() {
  //   map.removeLayer(marker);
  // });
  pingLayer.ping([d.location.longitude, d.location.latitude]);
}
function addText(d) {
  $('#created_time').text(new Date(parseInt(d.created_time) * 1000));
}

function raw_handler(data) {
  try {
    _.map(data, function(d) {
      addMarker(d);
      addText(d);
    });
  } catch(e) {
    console.log('cannot add point!');
  }
};

var proc;
function proc_handler(proc) {
  console.log('proc', proc);
  _.map(proc, function(v) {
      // Add rectangle
      var rect = L.rectangle([
        [v['lat']['min'], v['lon']['max']], 
        [v['lat']['max'], v['lon']['min']]
      ], {
        color  : "yellow",
        stroke : false
      })
      
      // Add popup
      var str = v['posts'] + '<br>'
      if(v['hashtags']) {
        _.map(_.flatten([v['hashtags']]), function(h) {
          str += h + '<br>'
        })
      }
      rect.bindPopup(str)
      
      rect.addTo(map);  
  });
}

var socket = io.connect('http://localhost');
socket.on('raw', raw_handler);
socket.on('proc', proc_handler);

var fill = d3.scale.category20();
//what range of font sizes do we want, we will scale the word counts
var fontSize = d3.scale.log().range([10, 90]);
//create my cloud object
var mycloud = d3.layout.cloud().size([300, 300])
      .words([])
      .padding(50)
      .rotate(function() { return ~~(Math.random() * 2) * 90; })
      // .rotate(function() { return 0; })
      .font("Impact")
      .fontSize(function(d) { return fontSize(d.size); })
      .on("end", draw)

//render the cloud with animations
function draw(words) {
  //fade existing tag cloud out
  d3.select("#chart2").selectAll("svg").selectAll("g")
    .transition()
    .duration(1000)
    .style("opacity", 1e-6)
    .remove();

      //render new tag cloud
      d3.select("#chart2").selectAll("svg")
          .append("g")
              .attr("transform", "translate(150,150)")
              .selectAll("text")
              .data(words)
          .enter().append("text")
          .style("font-size", function(d) { return ((d.size)* 1) + "px"; })
          .style("font-family", "Impact")
          .style("fill", function(d, i) { return fill(i); })
          .style("opacity", 1e-6)
          .attr("text-anchor", "middle")
    .attr("transform", function(d) { return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")"; })
          .transition()
          .duration(1000)
          .style("opacity", 1)
    .text(function(d) { return d.text; });
}

//create SVG container
d3.select("#chart2").append("svg")
  .attr("width", 400)
  .attr("height", 300);


Rickshaw.Graph.Socketio.Static = Rickshaw.Class.create( Rickshaw.Graph.Socketio, {
request: function() {
  var socket = io.connect(this.dataURL);
  thisData = this;
  socket.on('twitter', function (data) {
    //console.log("Got some fancy Websocket data: ");
    if(data['wc'].length>0){
       d3.layout.cloud().size([300, 300])
    .words(data['wc'])
    .padding(5)
    .rotate(function() { return ~~(Math.random() * 2) * 0; })
    .font("Impact")
    .fontSize(function(d) { return d.size; })
    .on("end", draw)
    .start();
     }

    console.log(data['ts']);
    thisData.success(data['ts']);
  });
}
} );

var socketioGraph = new Rickshaw.Graph.Socketio.Static( {
element: $('#chart_container')[0],
width: 400,
height: 200,
renderer: 'line',
min: 'auto',
dataURL: "http://localhost",
onData: function(d) {Rickshaw.Series.zeroFill(d); return d }
} );
