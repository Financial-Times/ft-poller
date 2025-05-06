'use strict';
const errors = require('./errors');
const logger = require('@dotcom-reliability-kit/logger');
const { fetch } = require('undici');

module.exports = EventEmitter => {

	class Poller extends EventEmitter {

		constructor (config) {
			super ();
			if (!config.url) {
				throw new Error ('ft-poller expects a url');
			}

			this.url = config.url;
			this.options = Object.assign({}, config.options || {});
			this.data = config.defaultData;
			this.state = Poller.states.INITIAL;

			if (this.options.timeout) {
				logger.warn({
					event: 'POLLER_DEPRECATED_OPTION',
					message: 'The `timeout` option is deprecated, use the standard `signal` option instead',
					option: 'timeout'
				});
			}

			// HACK:20250430:RM: We check whether AbortSignal.timeout exists here as many
			// of our apps use Jest + JSDom for testing which _still_ doesn't have
			// AbortSignal.timeout defined. There are plenty of places where ft-poller
			// isn't mocked in our tests. This means tests won't time out but it
			// shouldn't really matter in that context.
			if (AbortSignal.timeout && !this.options.signal) {
				this.options.signal = AbortSignal.timeout(this.options.timeout || 4000);
			}
			delete this.options.timeout;

			this.options.headers = this.options.headers || {};

			if (!this.options.headers['Content-Type'] && this.options.method === 'POST') {
				this.options.headers['Content-Type'] = 'application/json';
			}
			if (!this.options.headers.Accept) {
				this.options.headers['Accept'] = 'application/json';
			}

			this.refreshInterval = config.refreshInterval || 60000;
			this.parseData = config.parseData || function (data) {
				return data;
			};
			this.poller = undefined;
			if (config.autostart) {
				this.start ({initialRequest: true});
			}

			// We must listen to the error event to prevent throwing when we receive an HTTP error
			// https://nodejs.org/docs/latest-v16.x/api/events.html#error-events
			this.on('error', (error) => {
				this.error = error;
			});
		}

		isRunning () {
			return !!this.poller;
		}

		stop () {
			clearInterval (this.poller);
			this.poller = undefined;
			return true;
		}

		start (opts) {
			opts = opts || {};
			let initialPromise;
			if (!!this.isRunning ()) {
				throw new Error ('Could not start job because the service is already running');
			}

			if (opts.initialRequest) {
				initialPromise = this.fetch ();
			}

			this.poller = setInterval (() => {
				this.fetch ();
			}, this.refreshInterval);

			return opts.initialRequest ? initialPromise : Promise.resolve ();
		}

		retry () {
			this.fetch ();
			clearInterval (this.poller);
			this.poller = setInterval (() => {
				this.fetch ();
			}, this.refreshInterval);
		}

		fetch () {
			const time = new Date ();
			// Note - don't do this in the constructor as it means any instrumentation applied to fetch
			// later is discarded within pollers
			const _fetch = this.options.retry ? this.eagerFetch : fetch;
			const options = {...this.options};

			return _fetch (this.url, options)
				.then ((response) => {
					const latency = new Date () - time;
					if (response.ok) {
						this.error = undefined;
						this.emit ('ok', response, latency);
					} else {
						throw new errors.HttpError({url:this.url, method:this.options.method || 'GET', response});
					}
					if ((response.headers.get ('content-type') || '').indexOf ('json') > -1) {
						return response.json ();
					} else {
						return response.text ();
					}
				})
				.then (async s => {
					this.data = await this.parseData (s);
					this.setState (Poller.states.FRESH);
					this.emit ('data', this.data);
				})
				.catch ((err) => {
					if (this.state === Poller.states.INITIAL) {
						this.setState (Poller.states.ERRORING, err);
					} else {
						this.setState (Poller.states.STALE, err);
					}
					this.emit ('error', err);
				});
		}

		setState (state, error) {
			this.state = state;
			if (state === Poller.states.ERRORING) {
				logger.error (
					'Poller is serving default data. It was unable to fetch fresh data',
					{ event: 'POLLER_DATA_DEFAULT' },
					error
				);
			}
			if (state === Poller.states.STALE) {
				logger.warn (
					'Poller is serving stale data. It was unable to fetch fresh data',
					{ event: 'POLLER_DATA_STALE' },
					error
				);
			}
		}

		getData () {
			return this.data;
		}
	};

	Poller.states = {
		INITIAL: 'initial',
		ERRORING: 'erroring',
		STALE: 'stale',
		FRESH: 'fresh'
	};

	return Poller;
};
