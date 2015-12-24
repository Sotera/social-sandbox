const DEFAULT_COLOR   = 'rgba(200, 200, 200, .2)';
const HIGHLIGHT_COLOR = 'rgba(0, 0, 255, 1)';

var state = {
    xvar      : 'lon',
    yvar      : 'lat',
    threshold : .4,
}

function format_graph(data) {
    return {
        "network" : data,
        "meta"    : {
            'lat'  : {
                "min" : _.chain(data.nodes).pluck('lat').min().value(),
                "max" : _.chain(data.nodes).pluck('lat').max().value(),
            },
            'lon'  : {
                "min" : _.chain(data.nodes).pluck('lon').min().value(),
                "max" : _.chain(data.nodes).pluck('lon').max().value(),
            },
            'time'  : {
                "min" : _.chain(data.nodes).pluck('time').min().value(),
                "max" : _.chain(data.nodes).pluck('time').max().value(),
            },
        }
    }
}

var grapher;
var force;
function render_graph(data, callbacks) {
    console.log(data);
      // Generate some data
    if(grapher) {
        grapher.off('mousemove');    
    }

    grapher = undefined;
    $('#graph').css('display', 'inline')
    var div = $('#graph');
    
    var width  = div.width(),
        height = div.height(),
        i;

    var network = init_network(data, {"width" : width, "height" : height, "callbacks" : callbacks});
//        network.fix_dims(state.xvar, state.yvar);
        network.set_filter(state.threshold);

    // Create a grapher instance (width, height, options)
    grapher = new Grapher({
        canvas : document.getElementById('graph'),
        width  : width,
        height : height,
    });
    grapher.data(network.filtered);
        
    function make_force() {
        return d3.layout.force()
            .nodes(network.filtered.nodes)
            .links(network.filtered.links)
            .size([width, height])
            .on('tick', function() {grapher.update()})
            .linkStrength(0.5)
            .linkDistance(5)
            .charge(-10)
            // .friction(.5)
            .alpha(1)
            .start()
    }
            
    force = make_force();

    function getNodeIdAt(point) {
        var node = -1, x = point.x, y = point.y;

        network.filtered.nodes.every(function (n, i) {
            var inX = x <= n.x + n.r && x >= n.x - n.r,
                inY = y <= n.y + n.r && y >= n.y - n.r,
                found = inX && inY;
            if (found) node = i;
                return !found;
        });
        return node;
    };
        
    function getOffset (e) {
        if (e.offsetX) return {x: e.offsetX, y: e.offsetY};
        var rect = e.target.getBoundingClientRect();
        var x    = e.clientX - rect.left,
               y = e.clientY - rect.top;
        return {x: x, y: y};
    };

    // // Setup D3's force layout
    function simThresh_did_change(threshold) {
        network.set_filter(threshold);
        
        // Update data in grapher (so display changes)
        grapher.data(network.filtered);
        
        // Update data in force directed algorithm
        force.links(network.filtered.links);
        force.start();
    }

    // On mousedown, get ready for drag
    var startPoint;
    grapher.on('mousedown', function (e) {
        startPoint = getOffset(e);
    });
    grapher.on('mouseup', function onMouseUp (e) {
        startPoint = undefined;
    });

    // On mousemove, either pan or hover
    var hoveredNode;
    grapher.on('mousemove', function(e) {
        if (startPoint) {
            var translate = grapher.translate(),
                   offset = getOffset(e);

            translate[0] += (offset.x - startPoint.x);
            translate[1] += (offset.y - startPoint.y);

            startPoint = offset;
            grapher.translate(translate);
        } else {
            var eOffset = getOffset(e);
            var point   = grapher.getDataPosition(eOffset);
            var nodeId  = getNodeIdAt(point);
            
            if(nodeId > -1) {
                var thisNode = network.nodes[nodeId];
                
                if(hoveredNode) {
                    if(hoveredNode.id != thisNode.id) {
                        hoveredNode.unhover();
                    }
                }
                
                hoveredNode = thisNode;
                thisNode.hover();
                
                grapher.update();
            }
        }
    });

    // Handle key events
    var ref = 0;
    d3.select('body').on('keydown', function() {
        console.log('keydown ::', d3.event.keyCode);
        
        if(d3.event.keyCode == 38) { // Up
            state.threshold = state.threshold + 0.05;
            simThresh_did_change(state.threshold);
            console.log('increased threshold :: ', state.threshold);
            
        } else if(d3.event.keyCode == 40) { // Down
            state.threshold = state.threshold - 0.05;
            simThresh_did_change(state.threshold);
            console.log('decreased threshold ::', state.threshold);
            
        } else if(d3.event.keyCode == 65) { // a
            const cycle = [
                ['lon', 'lat'],
                ['lon', 'time'],
                ['time', 'lat']
            ];
            
            ref = (ref + 1) % 3;
            
            state.xvar = cycle[ref][0];
            state.yvar = cycle[ref][1];
            
            network.fix_dims(state.xvar, state.yvar);
            grapher.data(network.filtered);
            
            if(force.set_p) { force.set_p(); }
            
        } else if(d3.event.keyCode == 90) { // z
            force.start();
        } else if(d3.event.keyCode == 88) { // x
            force.stop();
        } else if(d3.event.keyCode == 67) { // c
            network.toggle_rainbow();
            grapher.update();
        } else if(d3.event.keyCode == 75) { // k
            // Toggle holding y
            force.toggle_fixX();
        } else if(d3.event.keyCode == 76) {
            // Toggle holding x
        } else {
            console.log('no key bound')
        }
    });

    grapher.on('wheel', function (e) {
        var center = getOffset(e);
        var delta  = - e.deltaY / 5000;
        grapher.zoom(1 + delta, center);
    });

    grapher.play();
}


function init_network(data, params) {

    make_color = function(val, use_rainbow) {
        if(!use_rainbow) {
            return '#' + rainbow.colourAt(val);
        } else {
            return '#' + rainbow.colourAt(val);
        }
    }

    var lookup  = {};
    var network = data.network;
    var meta    = data.meta;

    network.width       = params.width;
    network.height      = params.height;
    network.meta        = meta;
    network.use_rainbow = false;
    
    var rainbow = new Rainbow();
    rainbow.setNumberRange(0, 1);
    network.nodes = _.map(network.nodes, function(node, i) {
        
        lookup[node.id] = _.keys(lookup).length;
        
        var pos = {
           lat  : 1 - (node['lat'] - meta['lat'].min) / (meta['lat'].max - meta['lat'].min),
           lon  : (node['lon'] - meta['lon'].min)     / (meta['lon'].max - meta['lon'].min),
           time : (node['time'] - meta['time'].min)   / (meta['time'].max - meta['time'].min),
        }

        var col = make_color(1 - pos['time'], this.use_rainbow);
        var node = _.extend(node, {
            name  : lookup[node.id],
            
            lat  : pos['lat'],
            lon  : pos['lon'],
            time : pos['time'],
            
            r           : 2,
            color       : col,
            hovered     : false
        });
        
        node.hover = function() {
            this.color = HIGHLIGHT_COLOR;
            d3.select('#thumbnail').attr('src', this.path);
            if(!this.hovered) { params.callbacks.onHover(this); }
            this.hovered = true;
        }
        
        node.unhover = function() {
            this.color   = make_color(1 - this.time, network.use_rainbow);;
            this.hovered = false;
        }
        
        return node;                
    }.bind(this));
    
    network.links = _.chain(network.links).map(function(link) {
        if(network.nodes[lookup[link.target]]) {
            return _.extend(link, {
                from   : lookup[link.source],
                to     : lookup[link.target],
                source : network.nodes[lookup[link.source]],
                target : network.nodes[lookup[link.target]],
                color  : 'rgba(' + link.sim * 255 + ', ' + 0 + ', ' + 0 + ', ' + 2 * link.sim + ')',
                r      : .1
            })
        }
    }).filter(function(x) {return x != undefined}).value();

    var node_data = _.pluck(network.nodes,'name');
    var edge_data = _.map(network.links, function(x){return {"source":x.from,"target":x.to,"weight":1};});
    var community = jLouvain().nodes(node_data).edges(edge_data);  
    var community_assignment_result = community();
    var node_ids = Object.keys(community_assignment_result);

    network.numComms = _.max(_.values(community_assignment_result)) + 1;

    network.nodes = _.map(network.nodes, function(node, i) {
        node.community = community_assignment_result[node.name];
        console.log(node.community);
        return node;
    }.bind(this));

    
                
    // This could be sped up using crossfilter
    network.set_filter = function(threshold) {
        if(threshold) { this.threshold = threshold; }
        
        var links_sub = _.filter(this.links, function(link) {
            return link.sim > threshold
        });
        
                
        this.filtered = {
            "nodes" : network.nodes,
            "links" : links_sub
        };
    }
    
    network.fix_dims = function(x, y) {
        this.nodes = _.map(this.nodes, function(node) {
            if(x) { node.x = node[x] * params.width;  }
            if(y) { node.y = node[y] * params.height; }
            return node
        });
    }
    
    network.toggle_rainbow = function() {
        console.log('toggling rainbow');

        this.use_rainbow = !this.use_rainbow;
        this.nodes       = _.map(this.nodes, function(node) {
            if(!this.use_rainbow){console.log((node.community + .5) / network.numComms); node.color = make_color((node.community + 1) / network.numComms, this.use_rainbow); }
            else{node.color = make_color(1 - node.time, this.use_rainbow); }
            return node
        }.bind(this));
    }

    return network;
}