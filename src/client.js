class EventEmitter {

	constructor () {
		this.el = document.body;
	}

	emit (eventName, data) {
		this.el.dispatchEvent (new CustomEvent (eventName, { detail: data }));
	}

	on (eventName, fn) {
		this.el.addEventListener (eventName, fn, true);
	}
}

const Poller = require ('./poller')(EventEmitter);

// eager fetch not yet supported on client side
Poller.prototype.eagerFetch = fetch;

module.exports = Poller;
