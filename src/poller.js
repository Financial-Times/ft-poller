'use strict';

require('es6-promise').polyfill();
require('isomorphic-fetch');

var fetchres = require('fetchres');

var Poller = function(config) {
	if (!config.url) {
		throw 'ft-poller expects a url';
	}

	this.url = config.url;
	this.options = config.options || {};

	this.options.timeout = this.options.timeout || 4000;

	this.options.headers = this.options.headers || {};

	if (!this.options.headers['Content-Type']) {
		this.options.headers['Content-Type'] = 'application/json';
	}
	if (!this.options.headers.Accept) {
		this.options.headers['Accept'] = 'application/json';
	}

	this.refreshInterval = config.refreshInterval || 60000;
	this.parseData = config.parseData;
	this.poller = undefined;
};

Poller.prototype.isRunning = function () {
	return !!this.poller;
};

Poller.prototype.stop = function() {
	clearInterval(this.poller);
	this.poller = undefined;
	return true;
};

Poller.prototype.start = function (opts) {
	opts = opts || {};

	if (!!this.isRunning()) {
		throw new Error('Could not start job because the service is already running');
	}

	if (opts.initialRequest) {
		this.fetch();
	}

	var self = this;
	this.poller = setInterval(function () {
		self.fetch();
	}, this.refreshInterval);
};

Poller.prototype.fetch = function () {

	var time = new Date();
	var self = this;
	fetch(this.url, this.options)
		.then(function (response) {
			var latency = new Date() - time;
			if (response.status === 200) {
				self.emit('ok', response, latency);
			} else {
				throw response.body;
			}
			return response;
		})
		.then(fetchres.json)
		.then(function (s) {
			self.parseData(s);
		})
		.catch(function (err) {
			self.emit('error', err);
		});
};

module.exports = Poller;
