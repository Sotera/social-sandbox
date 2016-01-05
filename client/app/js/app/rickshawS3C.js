function RickshawS3C(params) {
    this.graph   = undefined;
    this.data    = undefined;
    this.preview = undefined;

    this.date_callback = params.date_callback || undefined;
    this.min_date = undefined;
    this.max_date = undefined;
    this.hoverTime = undefined;
}

RickshawS3C.prototype.reset = function() {
    // Teardown
    d3.select('#chart').remove();
    d3.select('#preview').remove();
    
    d3.select('#timeplot').append("div").attr("id","chart");
    d3.select('#timeplot').append("div").attr("id","preview");
};

RickshawS3C.prototype.update = function(x) {
    this.data.push(x);
    this.graph.update();
};

RickshawS3C.prototype.init = function(data) {
    this.reset();
    this.data = data;

    this.graph = new Rickshaw.Graph( {
        element  : document.getElementById("chart"),
        width    : $('#timeplot').width(),
        height   : $('#timeplot').height() * 0.8,
        renderer : 'line',
        series: [
            {
                'data'  : this.data,
                'name'  : current_scrape_name,
                'color' : "red"
            }
        ]
    } );

    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
        graph     : this.graph,
        formatter : function(series, x, y) {
            //RickshawS3C.prototype.hoverTime = x;
            //hoverTime = x;
            //this.hoverTime = x;
            //RickshawS3C.prototype.this.hoverTime = x;
            return y;
        },
        xFormatter: function(x) {
            return new Date(x).toString();
        }
    });

    var x_axis = new Rickshaw.Graph.Axis.X({
        'graph' : this.graph,
        'color' : 'red',
        tickFormat: function(x){
            return new Date(x).toLocaleDateString();
        }
    });
    


    var preview = new Rickshaw.Graph.RangeSlider.Preview({
        graph   : this.graph,
        element : document.getElementById('preview')
    });
    
    console.log(preview);
    preview.onSlide(function(e, min_date, max_date) {
        this.min_date = min_date;
        this.max_date = max_date;
        this.date_callback(min_date, max_date);
    }.bind(this));

    this.preview = preview;
    
    this.graph.render();

};
