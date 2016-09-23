'use strict';
const util = require('util');

var Poller = require('./poller');
Poller.prototype.eagerFetch = require('n-eager-fetch');
var EventEmitter = require('events').EventEmitter;

util.inherits(Poller, EventEmitter);

module.exports = Poller;
