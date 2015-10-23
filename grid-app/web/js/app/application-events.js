$(document).ready(function() {
    var socket = io.connect('http://localhost:3000/');
    socket.on('ned-give', onNed);
    
    socket.emit('start_ned', function() { console.log('start ned :: '); });
    
    function onNed(data) {
        console.log(data.current_date);
        $('#current-date').html(data.current_date);
        console.log(data);
    }
});