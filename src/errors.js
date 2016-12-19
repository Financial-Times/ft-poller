'use strict';

const urlParser = require('url');

class HttpError extends Error {

	constructor (opts){
		const response = opts.response;
		const method = opts.method;
		const url = opts.url;
		const message = `HTTP Error ${response.status} ${response.statusText}`;
		super(message);
		this.url = urlParser.parse(url, true);
		this.method = method;
		this._response = response;
		this.name = 'HttpError';
		this.message = message;
	}

	get status (){
		return this._response.statusCode;
	}

	responseBody (){
		return String(this._response.headers.get('Content-Type')).includes('json') ?
			this._response.json() :
			this._response.text();
	}
}

module.exports = {HttpError};
