'use strict';

var Poller = require('./poller');
var EventEmitter = require('events').EventEmitter;

var e = new EventEmitter();

// mixin the EventEmitter methods to Poller, Eg. poller.on('ok', ...)
Object.getOwnPropertyNames(EventEmitter.prototype).forEach(function (fn) {
		Poller.prototype[fn] = e[fn];
});

module.exports = Poller;
