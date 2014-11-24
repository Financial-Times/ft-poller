'use strict';

require('es6-promise').polyfill();

var request = require('request');

var Poller = function(config) {
    if (!config.options && !config.url) {
        throw 'ft-poller expects either a url or an options object compatible with request';
    }
    this.options = config.options || {
        url: config.url
    };

    this.options.timeout = this.options.timeout || 4000;

    this.options.headers = this.options.headers || {};

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
    
    new Promise(function (resolve, reject) {
        request(self.options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    }).then(function (response) {
        var latency = new Date() - time;
        if (response.statusCode === 200) {
            self.emit('ok', response, latency);
            return self.options.json ? response.body : JSON.parse(response.body);
        } else {
            throw response.body;
        }
    }).then(function (s) {
        self.parseData(s);
    }).catch(function (err) {
        self.emit('error', err);
    });
};

module.exports = Poller;