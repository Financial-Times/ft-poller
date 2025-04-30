'use strict';

const EventEmitter = require ('events').EventEmitter;
const Poller = require ('./poller')(EventEmitter);

Poller.prototype.eagerFetch = require('./eager-fetch');

module.exports = Poller;
