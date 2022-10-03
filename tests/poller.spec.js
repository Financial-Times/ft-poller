/* global it, describe, xit */

const mockery = require ('mockery');
const chai = require ('chai');
const sinon = require ('sinon');
const nock = require ('nock');
const expect = chai.expect;
const HttpError = require('../src/errors').HttpError;

mockery.enable ({
	warnOnReplace: false,
	warnOnUnregistered: false
});

const mockLogger = {
	error: sinon.stub(),
	warn: sinon.stub()
};
mockery.registerMock ('@financial-times/n-logger', { default: mockLogger });

const Poller = require ('../src/server');

describe ('Poller', function () {

	it ('Should exist', function () {
		expect (new Poller( { url: '/' } )).to.be.defined;
	});

	it ('Should start a job', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		expect (poller.isRunning ()).to.equal (true);
	});

	it ('Should avoid starting a job twice', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		expect (function () {
			poller.start ();
		}).to.throw ('Could not start job because the service is already running');
	});

	it ('Should stop a job', function () {
		const poller = new Poller( { url: '/' } );
		poller.start ();
		poller.stop ();
		expect (poller.isRunning ()).to.equal (false);
	});

	it ('Regression test: Should pass a JSON object to the given callback when the Content-Type contains but does not equal application/json (e.g. bertha)', function (done) {

		const ft = nock ('http://example.com')
			.get ('/json-charset')
			.reply (200, { 'foo': 1 }, { 'Content-Type': 'application/json; charset=utf-8' });

		const p = new Poller( {
				url: 'http://example.com/json-charset',
				parseData: function (res) {
					expect (ft.isDone ()).to.be.true; // ensure Nock has been used
					expect (res.foo).to.equal (1);
					done ();
				}
		});

		p.fetch ();
	});

	it ('Should pass a JSON object to the given callback', function (done) {

		const ft = nock ('http://example.com')
			.get ('/json')
			.reply (200, { 'foo': 1 });

		const p = new Poller( {
				url: 'http://example.com/json',
				parseData: function (res) {
					expect (ft.isDone ()).to.be.true; // ensure Nock has been used
					expect (res.foo).to.equal (1);
					done ();
				}
		});

		p.fetch ();
	});

	it ('Should pass a text object to the given callback', function (done) {

		const ft = nock ('http://example.com')
			.get ('/')
			.reply (200, 'hello world');

		const p = new Poller( {
				url: 'http://example.com',
				parseData: function (res) {
					expect (ft.isDone ()).to.be.true; // ensure Nock has been used
					expect (res).to.equal ('hello world');
					done ();
				}
		});

		p.fetch ();
	});

	it ('Should check the poller interval runs correctly', function (done) {

		const ft = nock ('http://example.com')
			.get ('/')
			.reply (200, { 'foo': 1 });

		const clock = sinon.useFakeTimers ();

		const poller = new Poller({
				url: 'http://example.com',
				refreshInterval: 5000,
				parseData: function (res) {
					expect (res.foo).to.equal (1);
					expect (ft.isDone ()).to.be.true; // ensure Nock has been used
					done ();
				}
			});

		poller.start ();
		clock.tick (6000);  // fast-forward 6 seconds
		clock.restore ();

	});

	it ('Should allow the first scheduled poll to happen immediately', function () {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');
		poller.start ({ initialRequest: true });
		expect (spy.callCount).to.equal (1);
	});

	it ('Should return a promise which resolves when initial fetch happens', function (done) {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');

		const eventEmitterStub = sinon.stub (poller, 'emit');

		poller.start ({ initialRequest: true }).then (function () {
			expect (eventEmitterStub.calledOnce).to.be.true;
			done ();
		});
		expect (spy.callCount).to.equal (1);
	});

	it ('Should resolve start with a promise immediately when not doing an initial fetch', function (done) {
		const poller = new Poller( { url: '/' } );
		const spy = sinon.spy (poller, 'fetch');

		const eventEmitterStub = sinon.stub (poller, 'emit');

		poller.start ().then (function () {
			expect (eventEmitterStub.calledOnce).to.be.false;
			done ();
		});
		expect (spy.callCount).to.equal (0);
	});

	it ('Should fire an event when a error is received from the server', function (done) {

		const ft = nock ('http://example.com')
			.get ('/')
			.reply (503, {});

		const p = new Poller({
			url: 'http://example.com'
		});

		const eventEmitterStub = sinon.stub (p, 'emit');
		p.fetch ();

		setTimeout (function () {
			expect (ft.isDone ()).to.be.true; // ensure Nock has been used
			expect (eventEmitterStub.calledOnce).to.be.true;
			expect (eventEmitterStub.getCall (0).args[0]).to.equal ('error');
			expect(eventEmitterStub.getCall (0).args[1]).to.be.an.instanceOf(HttpError);
			done ();
		}, 10);

	});

	it ('Should return defaultData if the server errors after the poller autostarts without listening for errors', function (done) {

		const ft = nock ('http://example.com')
			.get ('/')
			.reply (503, {});

		const defaultData = [1, 2, 3]

		const p = new Poller({
			url: 'http://example.com',
			defaultData,
			autostart: true,
		});

		const eventEmitterStub = sinon.stub (p, 'emit');

		setTimeout (function () {
			expect (p.getData()).to.deep.equal(defaultData);
			expect (ft.isDone()).to.be.true; // ensure Nock has been used
			expect (eventEmitterStub.calledOnce).to.be.true;
			expect (eventEmitterStub.getCall (0).args[0]).to.equal ('error');
			expect(eventEmitterStub.getCall (0).args[1]).to.be.an.instanceOf(HttpError);
			done ();
		}, 10);

	});

	it ('Should annotate the polling response with latency information', function (done) {

		const ft = nock ('http://example.com')
			.get ('/1')
			.reply (200, { 'foo': 1 });

		const p = new Poller( { url: 'http://example.com/1', parseData: function () {} } );

		const eventEmitterStub = sinon.stub (p, 'emit');
		p.fetch ();

		setTimeout (function () {
			expect (ft.isDone ()).to.be.true; // ensure Nock has been used
			expect (eventEmitterStub.called).to.be.true;
			expect (eventEmitterStub.getCall (0).args[0]).to.equal ('ok');
			expect (eventEmitterStub.getCall (0).args[2]).to.match (/^\d+$/);
			done ();
		}, 10);
	});

	it ('Should handle POST requests', function (done) {

		const ft = nock ('http://example.com')
			.post ('/1')
			.reply (200, { 'foo': 1 });

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
			expect (ft.isDone ()).to.be.true; // ensure Nock has been used
			expect (eventEmitterStub.called).to.be.true;
			expect (eventEmitterStub.getCall (0).args[0]).to.equal ('ok');
			expect (eventEmitterStub.getCall (0).args[2]).to.match (/^\d+$/);
			done ();
		}, 10);
	});

	it ('Should be possible to retry requests', function () {
		sinon.stub (Poller.prototype, 'eagerFetch', function () {
			return Promise.reject ({
				message: 'network timeout at 12345'
			});
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
		expect (p.eagerFetch.calledOnce).to.be.true;
		Poller.prototype.eagerFetch.restore ();

	});

	it ('Should be possible to act as data container', function (done) {

		nock ('http://example.com')
			.get ('/json')
			.reply (200, { 'foo': 1 });

		const p = new Poller( {
				url: 'http://example.com/json',
				defaultData: 0,
				parseData: function (res) {
					return res.foo;
				}
		});

		expect (p.getData ()).to.equal (0);

		p.fetch ();
		setTimeout (function () {
			expect (p.getData ()).to.equal (1);
			done ();
		}, 10);
	});

	it ('Should define a default data parser', function (done) {

		nock ('http://example.com')
			.get ('/json')
			.reply (200, { 'foo': 1 });

		const p = new Poller( {
				url: 'http://example.com/json',
				defaultData: {}
		});

		p.fetch ();
		setTimeout (function () {
			expect (p.getData ()).to.deep.equal ({foo: 1});
			done ();
		}, 10);
	});

	it ('Should allow async data parser', function (done) {

		nock ('http://example.com')
			.get ('/json')
			.reply (200, { 'foo': 1 });

		const p = new Poller( {
				url: 'http://example.com/json',
				defaultData: {},
				parseData: () => Promise.resolve({bar: 2})
		});

		p.fetch ();
		setTimeout (function () {
			expect (p.getData ()).to.deep.equal ({bar: 2});
			done ();
		}, 10);
	});

	it ('Should be possible to autostart', function () {

		nock ('http://example.com')
			.get ('/json')
			.reply (200, { 'foo': 1 });

		const stub = sinon.stub (Poller.prototype, 'start');

		const p = new Poller( {
				url: 'http://example.com/json',
				defaultData: {},
				autostart: true
		});

		expect (p.start.calledOnce).to.be.true;
		expect (p.start.args[0][0]).to.deep.equal ({initialRequest: true});
		stub.restore ();
	});

	xit ('Should allow a maximum HTTP timeout of 4000ms');
	xit ('Should respond to receiving a Retry-After header');

	it ('Should fire a "data" event when new data is received and parsed', (done) => {
		const stub = { 'foo': 1 };
		nock ('http://example.com')
			.get ('/json')
			.reply (200, stub);

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: 0
		});

		p.start ({initialRequest:true});
		p.once ('data', data => {
			expect (data).to.deep.equal (stub);
			done ();
		});
	});

	it ('Should have the ability to manually retry', done => {
		const stub1 = { 'foo': 1 };
		nock ('http://example.com')
			.get ('/json')
			.reply (200, stub1);

		const p = new Poller( {
			url: 'http://example.com/json',
			defaultData: 0
		});

		const onSecond = data => {
			try{
				expect (data).to.deep.equal (stub1);
				done ();
			}catch (e) {
				done (e);
			}

		};

		const onFirst = () => {
			p.once ('data', onSecond);
			p.retry ();
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
			expect(poller.state).to.equal('initial');
		});

		it('should have default data', () => {
			expect(poller.getData()).to.deep.equal({ isDefaultData: true });
		});

		describe('when the first fetch resolves', () => {

			beforeEach(async () => {
				nock('http://example.com')
					.get('/states')
					.once()
					.reply(200, { isOriginalData: true });
				await poller.fetch();
			});

			it('should have a state of "fresh"', () => {
				expect(poller.state).to.equal('fresh');
			});

			it('should have fresh data', () => {
				expect(poller.getData()).to.deep.equal({ isOriginalData: true });
			});

			it('should not log errors or warnings', () => {
				expect(mockLogger.error.callCount).to.equal(0);
				expect(mockLogger.warn.callCount).to.equal(0);
			});

			describe('when the second fetch rejects', () => {

				beforeEach(async () => {
					nock('http://example.com')
						.get('/states')
						.once()
						.reply(500, { isDataFromError: true });
					await poller.fetch();
				});

				it('should have a state of "stale"', () => {
					expect(poller.state).to.equal('stale');
				});

				it('should have stale data', () => {
					expect(poller.getData()).to.deep.equal({ isOriginalData: true });
				});

				it('should log a warning message', () => {
					expect(mockLogger.warn.callCount).to.equal(1);
					const args = mockLogger.warn.getCall(0).args;
					expect(args[0]).to.equal('Poller is serving stale data. It was unable to fetch fresh data');
					expect(args[1]).to.deep.equal({ event: 'POLLER_DATA_STALE' });
					expect(args[2]).to.be.instanceOf(HttpError);
				});

			});

		});

		describe('when the first fetch rejects', () => {

			beforeEach(async () => {
				nock('http://example.com')
					.get('/states')
					.once()
					.reply(500, { isDataFromError: true });
				await poller.fetch();
			});

			it('should have a state of "erroring"', () => {
				expect(poller.state).to.equal('erroring');
			});

			it('should have default data', () => {
				expect(poller.getData()).to.deep.equal({ isDefaultData: true });
			});

			it('should log an error message', () => {
				expect(mockLogger.error.callCount).to.equal(1);
				const args = mockLogger.error.getCall(0).args;
				expect(args[0]).to.equal('Poller is serving default data. It was unable to fetch fresh data');
				expect(args[1]).to.deep.equal({ event: 'POLLER_DATA_DEFAULT' });
				expect(args[2]).to.be.instanceOf(HttpError);
			});

		});

	});

});
