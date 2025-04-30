/* global afterEach, beforeEach, it, describe */

const assert = require('node:assert/strict');
const mockery = require ('mockery');
const sinon = require ('sinon');
const { MockAgent, setGlobalDispatcher } = require('undici');
const HttpError = require('../src/errors').HttpError;

mockery.enable ({
	warnOnReplace: false,
	warnOnUnregistered: false
});

const mockLogger = {
	error: sinon.stub(),
	warn: sinon.stub()
};
mockery.registerMock ('@dotcom-reliability-kit/logger', mockLogger);

const Poller = require ('../src/server');

describe ('Poller', function () {
	/** @type {import('undici').MockAgent} */
	let mockAgent;

	beforeEach(function () {
		mockAgent = new MockAgent();
		mockAgent.disableNetConnect();
		setGlobalDispatcher(mockAgent);
	});

	afterEach(async () => {
		await mockAgent.close();
	});

	it ('Should exist', function () {
		assert.notEqual (new Poller( { url: '/' } ), undefined);
	});

	it ('Should start a job', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		assert.equal (poller.isRunning (), true);
		poller.stop ();
	});

	it ('Should avoid starting a job twice', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		assert.throws (function () {
			poller.start ();
		}, /Could not start job because the service is already running/i);
		poller.stop ();
	});

	it ('Should stop a job', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		poller.stop ();
		assert.equal (poller.isRunning (), false);
	});

	it ('Regression test: Should pass a JSON object to the given callback when the Content-Type contains but does not equal application/json (e.g. bertha)', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json-charset' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json-charset',
			parseData: function (res) {
				assert.equal (res.foo, 1);
				done ();
			}
		});

		p.fetch ();
	});

	it ('Should pass a JSON object to the given callback', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json',
			parseData: function (res) {
				assert.equal (res.foo, 1);
				done ();
			}
		});

		p.fetch ();
	});

	it ('Should pass a text object to the given callback', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/' })
			.reply(200, 'hello world', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com',
			parseData: function (res) {
				assert.equal (res, 'hello world');
				done ();
			}
		});

		p.fetch ();
	});

	it ('Should check the poller interval runs correctly', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const clock = sinon.useFakeTimers ();

		const poller = new Poller({
			url: 'http://example.com',
			refreshInterval: 5000,
			parseData: function (res) {
				assert.equal (res.foo, 1);
				done ();
			}
		});

		poller.start ();
		clock.tick (6000); // fast-forward 6 seconds
		clock.restore ();
		poller.stop ();
	});

	it ('Should allow the first scheduled poll to happen immediately', function () {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');
		poller.start ({ initialRequest: true });
		assert.equal (spy.callCount, 1);
		poller.stop ();
	});

	it ('Should return a promise which resolves when initial fetch happens', function (done) {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');

		const eventEmitterStub = sinon.stub (poller, 'emit');

		poller.start ({ initialRequest: true }).then (function () {
			assert.equal (eventEmitterStub.calledOnce, true);
			done ();
		});
		assert.equal (spy.callCount, 1);
		poller.stop ();
	});

	it ('Should resolve start with a promise immediately when not doing an initial fetch', function (done) {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');

		const eventEmitterStub = sinon.stub (poller, 'emit');

		poller.start ().then (function () {
			assert.equal (eventEmitterStub.calledOnce, false);
			done ();
		});
		assert.equal (spy.callCount, 0);
		poller.stop ();
	});

	it ('Should fire an event when a error is received from the server', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/' })
			.reply(503, {}, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller({
			url: 'http://example.com'
		});

		const eventEmitterStub = sinon.stub (p, 'emit');
		p.fetch ();

		setTimeout (function () {
			assert.equal (eventEmitterStub.calledOnce, true);
			assert.equal (eventEmitterStub.getCall (0).args[0], 'error');
			assert.ok (eventEmitterStub.getCall (0).args[1] instanceof HttpError);
			done ();
		}, 10);

	});

	it ('Should return defaultData if the server errors after the poller autostarts without listening for errors', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/' })
			.reply(503, {}, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const defaultData = [1, 2, 3];

		const p = new Poller({
			url: 'http://example.com',
			defaultData,
			autostart: true,
		});

		const eventEmitterStub = sinon.stub (p, 'emit');

		setTimeout (function () {
			assert.deepEqual (p.getData(), defaultData);
			assert.equal (eventEmitterStub.calledOnce, true);
			assert.equal (eventEmitterStub.getCall (0).args[0], 'error');
			assert.ok (eventEmitterStub.getCall (0).args[1] instanceof HttpError);
			done ();
		}, 10);
		p.stop ();
	});

	it ('Should annotate the polling response with latency information', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/1' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( { url: 'http://example.com/1', parseData: function () {} } );

		const eventEmitterStub = sinon.stub (p, 'emit');
		p.fetch ();

		setTimeout (function () {
			assert.equal (eventEmitterStub.called, true);
			assert.equal (eventEmitterStub.getCall (0).args[0], 'ok');
			assert.equal (typeof eventEmitterStub.getCall (0).args[2], 'number');
			done ();
		}, 10);
	});

	it ('Should handle POST requests', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/1', method: 'POST' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller({
			url: 'http://example.com/1',
			options: {
				method: 'POST'
			},
			parseData: function () {}
		});

		const eventEmitterStub = sinon.stub (p, 'emit');
		p.fetch ();

		setTimeout (function () {
			assert.equal (eventEmitterStub.called, true);
			assert.equal (eventEmitterStub.getCall (0).args[0], 'ok');
			assert.equal (typeof eventEmitterStub.getCall (0).args[2], 'number');
			done ();
		}, 10);
	});

	it ('Should be possible to retry requests', function () {
		sinon.stub (Poller.prototype, 'eagerFetch').callsFake(function () {
			return Promise.reject (new Error ('network timeout at 12345'));
		});
		const p = new Poller({
			url: 'http://example.com/1',
			options: {
				method: 'POST',
				retry: 2,
			},
			parseData: function () {}
		});


		p.fetch ();
		assert.equal (p.eagerFetch.calledOnce, true);
		Poller.prototype.eagerFetch.restore ();

	});

	it ('Should be possible to act as data container', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: 0,
			parseData: function (res) {
				return res.foo;
			}
		});

		assert.equal (p.getData (), 0);

		p.fetch ();
		setTimeout (function () {
			assert.equal (p.getData (), 1);
			done ();
		}, 10);
	});

	it ('Should define a default data parser', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: {}
		});

		p.fetch ();
		setTimeout (function () {
			assert.deepEqual (p.getData (), {foo: 1});
			done ();
		}, 10);
	});

	it ('Should allow async data parser', function (done) {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: {},
			parseData: () => Promise.resolve({bar: 2})
		});

		p.fetch ();
		setTimeout (function () {
			assert.deepEqual (p.getData (), {bar: 2});
			done ();
		}, 10);
	});

	it ('Should be possible to autostart', function () {

		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, { foo: 1 }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const stub = sinon.stub (Poller.prototype, 'start');

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: {},
			autostart: true
		});

		assert.equal (p.start.calledOnce, true);
		assert.deepEqual (p.start.args[0][0], {initialRequest: true});
		stub.restore ();
		p.stop ();
	});

	it ('Should fire a "data" event when new data is received and parsed', (done) => {
		const stub = { foo: 1 };
		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, stub, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: 0
		});

		p.start ({initialRequest:true});
		p.once ('data', data => {
			assert.deepEqual (data, stub);
			done ();
		});
		p.stop ();
	});

	it ('Should have the ability to manually retry', done => {
		const stub1 = { foo: 1 };
		mockAgent.get('http://example.com')
			.intercept({ path: '/json' })
			.reply(200, stub1, { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
			.times(2);

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: 0
		});

		const onSecond = data => {
			try{
				assert.deepEqual (data, stub1);
				done ();
			}catch (e) {
				done (e);
			}

		};

		const onFirst = () => {
			p.once ('data', onSecond);
			p.retry ();
			p.stop ();
		};

		p.once ('data', onFirst);

		p.start ({initialRequest:true});
	});

	describe('state management and logging', () => {
		let poller;

		beforeEach(() => {
			mockLogger.error.reset();
			mockLogger.warn.reset();
			poller = new Poller({
				url: 'http://example.com/states',
				defaultData: { isDefaultData: true }
			});
		});

		it('should have a state of "initial"', () => {
			assert.equal(poller.state, 'initial');
		});

		it('should have default data', () => {
			assert.deepEqual(poller.getData(), { isDefaultData: true });
		});

		describe('when the first fetch resolves', () => {

			beforeEach(async () => {
				mockAgent.get('http://example.com')
					.intercept({ path: '/states' })
					.reply(200, { isOriginalData: true }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
				await poller.fetch();
			});

			it('should have a state of "fresh"', () => {
				assert.equal(poller.state, 'fresh');
			});

			it('should have fresh data', () => {
				assert.deepEqual(poller.getData(), { isOriginalData: true });
			});

			it('should not log errors or warnings', () => {
				assert.equal(mockLogger.error.callCount, 0);
				assert.equal(mockLogger.warn.callCount, 0);
			});

			describe('when the second fetch rejects', () => {

				beforeEach(async () => {
					mockAgent.get('http://example.com')
						.intercept({ path: '/states' })
						.reply(500, { isDataFromError: true }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
					await poller.fetch();
				});

				it('should have a state of "stale"', () => {
					assert.equal(poller.state, 'stale');
				});

				it('should have stale data', () => {
					assert.deepEqual(poller.getData(), { isOriginalData: true });
				});

				it('should log a warning message', () => {
					assert.equal(mockLogger.warn.callCount, 1);
					const args = mockLogger.warn.getCall(0).args;
					assert.equal(args[0], 'Poller is serving stale data. It was unable to fetch fresh data');
					assert.deepEqual(args[1], { event: 'POLLER_DATA_STALE' });
					assert.ok (args[2] instanceof HttpError);
				});

			});

		});

		describe('when the first fetch rejects', () => {

			beforeEach(async () => {
				mockAgent.get('http://example.com')
					.intercept({ path: '/states' })
					.reply(500, { isDataFromError: true }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
				await poller.fetch();
			});

			it('should have a state of "erroring"', () => {
				assert.equal(poller.state, 'erroring');
			});

			it('should have default data', () => {
				assert.deepEqual(poller.getData(), { isDefaultData: true });
			});

			it('should log an error message', () => {
				assert.equal(mockLogger.error.callCount, 1);
				const args = mockLogger.error.getCall(0).args;
				assert.equal(args[0], 'Poller is serving default data. It was unable to fetch fresh data');
				assert.deepEqual(args[1], { event: 'POLLER_DATA_DEFAULT' });
				assert.ok (args[2] instanceof HttpError);
			});

		});

	});

});
