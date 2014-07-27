'use strict';

var domain = require('domain');
var request = require('superagent');
var superPromise = require('superagent-promises');

var Poller = function(config) {
    this.url = config.url;
    this.refreshInterval = config.refreshInterval || 60000;
    this.parseData = config.parseData;
    this.poller = undefined;
    this.name = config.name;
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
   
    var opts = opts || {}
 
    if (!!this.isRunning()) {
        console.error('poller.js, could not start because the service is already running', this.url);
        return false;
    }

    if (opts.initialRequest) {
        this.fetch();
    }

    var self = this;
    this.poller = setInterval(function () {
        console.log('poller.js, fetching', self.url);
        self.fetch();
    }, this.refreshInterval);
};

Poller.prototype.fetch = function () {
       
    var promisedData = function (url) { 

        return request
            .get(url)
            // .set('Accept', 'application/json')
            .timeout(30000)
            .use(superPromise)
            .end()
            .then(function (response) {
                if (response.statusCode === 200) {
                    console.log('poller.js, data promise has been resolved with response, ', response.text.replace(/([\n\r\t]|\s{2,})/g, '').substring(0, 50));
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
                console.error('poller.js, error fetching', self.url, err);
            });
};

module.exports = Poller;
