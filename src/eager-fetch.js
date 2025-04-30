// Copied from https://github.com/Financial-Times/n-eager-fetch/blob/main/main.js
// now that n-eager-fetch is end-of-life
'use strict';

const { fetch } = require('undici');

module.exports = function eagerFetch (url, opts) {
	let retriesLeft = opts.retry;

	// Not a valid fetch option so we remove it
	delete opts.retry;

	function fetchAttempt () {
		const fetchCall = fetch(url, opts)
			.catch( (err) => {
				if (err.name === 'TimeoutError') {
					return { ok: false };
				} else {
					throw err;
				}
			})
			.then(function (response) {
				if (!response.ok && retriesLeft > 0) {
					retriesLeft--;
					return fetchAttempt();
				}
				return response;
			});

		fetchCall.stopRetrying = function () {
			retriesLeft = 0;
		};

		return fetchCall;
	}

	return fetchAttempt();
};
