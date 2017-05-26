node_modules/@financial-times/n-gage/index.mk:
	npm install @financial-times/n-gage
	touch $@

-include node_modules/@financial-times/n-gage/index.mk

test: unit-test verify

unit-test:
	mocha tests/poller.spec.js
