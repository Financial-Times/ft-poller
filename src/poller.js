'use strict';

var request = require('superagent');
var superPromise = require('superagent-promises');

var Poller = function(config) {
    this.url = config.url;
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
   
    var opts = opts || {};
 
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
       
    var time = new Date(),
        promisedData = function (url) { 
            return request
                .get(url)
                .set('Accept', 'application/json')
                .timeout(4000)
                .use(superPromise)
                .end()
                .then(function (response) {
                    var latency = new Date() - time;
                    if (response.statusCode === 200) {
                        self.emit('ok', response, latency);
                        return JSON.parse(response.text);
                    } 
                });
    };

    var self = this;
      
    // hydrate the data models 
    promisedData(self.url) 
        .then(function (s) {
            self.parseData(s);
        }).catch(function (err) {
            self.emit('error', err);
        });
};

module.exports = Poller;
