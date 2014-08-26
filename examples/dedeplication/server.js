
var express = require('express');
var app = express();

var getRandomIntegers = function () {
    var min = 1, max = 9;
    return [1, 2, 3].map(function () {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    })
}
    
app.get('/1', function(req, res){
    res.send({ 'hello': getRandomIntegers() });
});

app.listen(3000);
