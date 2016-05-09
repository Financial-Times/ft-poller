include n.Makefile

test: unit-test verify

unit-test:
	mocha tests/poller.spec.js
