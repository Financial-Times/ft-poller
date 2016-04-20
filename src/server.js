'use strict';

var Poller = require('./poller');
Poller.prototype.eagerFetch = require('n-eager-fetch');

module.exports = Poller;
