var Poller = require('./poller');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var e = new EventEmitter();

// mixin the EventEmitter methods to Poller, Eg. poller.on('ok', ...)
Object.getOwnPropertyNames(EventEmitter.prototype).forEach(function (fn) {
    Poller.prototype[fn] = e[fn];
})

module.exports = Poller;
