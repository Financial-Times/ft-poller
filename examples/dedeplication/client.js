
GLOBAL.Promise = require('es6-promise').Promise;

var Poller = require('../../src/poller'),
    response = { },
    host = 'localhost:3000'
    opts = { initialRequest: true };

// Generate three lists of numbers at different intervals 

new Poller({ url: host + '/1', refreshInterval: 5000, parseData: function (data) { response.one   = data.hello; } }).start(opts);
new Poller({ url: host + '/1', refreshInterval: 1000, parseData: function (data) { response.two   = data.hello; } }).start(opts);
new Poller({ url: host + '/1', refreshInterval: 8000, parseData: function (data) { response.three = data.hello; } }).start(opts);

// Imagine this was part of the rendering of the application, where we want to
// de-duplicate three lists of content before we pass to the user.

setInterval(function () {

    if (Object.keys(response).length === 0) {
        return false; 
    }
    
    var headlines = Object
        .keys(response)
        .map(function (key) { // cast the responses to arrays
            return response[key]
        })
        .reduce(function (a, b) { // flatten the array
            return a.concat(b);
        })
        .filter(function (el, i, arr) { // de-duplicate
            return arr.indexOf(el) === i;
        })

    console.log(headlines.sort())

}, 1000)
