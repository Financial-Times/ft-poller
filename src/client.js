/*global CustomElement */
'use strict';

var Poller = require('./poller');
// eager fetch not yet supported on client side
Poller.prototype.eagerFetch = fetch;
var el = document.body;

Poller.prototype.emit = function (eventName, data) {
		el.dispatchEvent(new CustomElement(eventName, { detail: data }));
};

Poller.prototype.on = function (eventName, fn) {
		el.addEventListener(eventName, fn, true);
};

module.exports = Poller;
