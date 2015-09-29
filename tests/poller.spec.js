/* global it, describe, xit */
'use strict';

var chai = require('chai');
var Poller = require('../src/server');
var sinon = require('sinon');
var nock = require('nock');
var expect = chai.expect;

describe('Poller', function() {

	it('Should exist', function() {
		expect(new Poller( { url: '/' } )).to.be.defined;
	});

	it('Should start a job', function() {
		var poller = new Poller( { url: '/' } );
		poller.start();
		expect(poller.isRunning()).to.equal(true);
	});

	it('Should avoid starting a job twice', function() {
		var poller = new Poller( { url: '/' } );
		poller.start();
		expect(function () {
			poller.start();
		}).to.throw('Could not start job because the service is already running');
	});

	it('Should stop a job', function() {
		var poller = new Poller( { url: '/' } );
		poller.start();
		poller.stop();
		expect(poller.isRunning()).to.equal(false);
	});

	it('Regression test: Should pass a JSON object to the given callback when the Content-Type contains but does not equal application/json (e.g. bertha)', function(done) {

		var ft = nock('http://example.com')
			.get('/json-charset')
			.reply(200, { 'foo': 1 }, { 'Content-Type': 'application/json; charset=utf-8' });

		var p = new Poller( {
				url: 'http://example.com/json-charset',
				parseData: function (res) {
					expect(ft.isDone()).to.be.true; // ensure Nock has been used
					expect(res.foo).to.equal(1);
					done();
				}
		});

		p.fetch();
	});

	it('Should pass a JSON object to the given callback', function(done) {

		var ft = nock('http://example.com')
			.get('/json')
			.reply(200, { 'foo': 1 });

		var p = new Poller( {
				url: 'http://example.com/json',
				parseData: function (res) {
					expect(ft.isDone()).to.be.true; // ensure Nock has been used
					expect(res.foo).to.equal(1);
					done();
				}
		});

		p.fetch();
	});

	it('Should pass a text object to the given callback', function(done) {

		var ft = nock('http://example.com')
			.get('/')
			.reply(200, 'hello world');

		var p = new Poller( {
				url: 'http://example.com',
				parseData: function (res) {
					expect(ft.isDone()).to.be.true; // ensure Nock has been used
					expect(res).to.equal('hello world');
					done();
				}
		});

		p.fetch();
	});

	it('Should check the poller interval runs correctly', function(done) {

		var ft = nock('http://example.com')
			.get('/')
			.reply(200, { 'foo': 1 });

		var clock = sinon.useFakeTimers();

		var poller = new Poller({
				url: 'http://example.com',
				refreshInterval: 5000,
				parseData: function (res) {
					expect(res.foo).to.equal(1);
					expect(ft.isDone()).to.be.true; // ensure Nock has been used
					done();
				}
			});

		poller.start();
		clock.tick(6000);  // fast-forward 6 seconds
		clock.restore();

	});

	it('Should allow the first scheduled poll to happen immediately', function() {
		var poller = new Poller( { url: '/' } );
		var spy = sinon.spy(poller, 'fetch');
		poller.start( { initialRequest: true });
		expect(spy.callCount).to.equal(1);
	});

	it('Should fire an event when a error is received from the server', function(done) {

		var ft = nock('http://example.com')
			.get('/')
			.reply(503, {});

		var p = new Poller({
			url: 'http://example.com'
		});

		var eventEmitterStub = sinon.stub(p, 'emit');
		p.fetch();

		setTimeout(function () {
			expect(ft.isDone()).to.be.true; // ensure Nock has been used
			expect(eventEmitterStub.calledOnce).to.be.true;
			expect(eventEmitterStub.getCall(0).args[0]).to.equal('error');
			done();
		}, 10);

	});

	it('Should annotate the polling response with latency information', function(done) {

		var ft = nock('http://example.com')
			.get('/1')
			.reply(200, { 'foo': 1 });

		var p = new Poller( { url: 'http://example.com/1', parseData: function () {} } );

		var eventEmitterStub = sinon.stub(p, 'emit');
		p.fetch();

		setTimeout(function () {
			expect(ft.isDone()).to.be.true; // ensure Nock has been used
			expect(eventEmitterStub.calledOnce).to.be.true;
			expect(eventEmitterStub.getCall(0).args[0]).to.equal('ok');
			expect(eventEmitterStub.getCall(0).args[2]).to.match(/^\d+$/);
			done();
		}, 10);
	});

	it('Should handle POST requests', function(done) {

		var ft = nock('http://example.com')
			.post('/1')
			.reply(200, { 'foo': 1 });

		var p = new Poller({
			url: 'http://example.com/1',
			options: {
				method: 'POST'
			},
			parseData: function () {}
		});

		var eventEmitterStub = sinon.stub(p, 'emit');
		p.fetch();

		setTimeout(function () {
			expect(ft.isDone()).to.be.true; // ensure Nock has been used
			expect(eventEmitterStub.calledOnce).to.be.true;
			expect(eventEmitterStub.getCall(0).args[0]).to.equal('ok');
			expect(eventEmitterStub.getCall(0).args[2]).to.match(/^\d+$/);
			done();
		}, 10);
	});

	xit('Should allow a maximum HTTP timeout of 4000ms');
	xit('Should respond to receiving a Retry-After header');

});
