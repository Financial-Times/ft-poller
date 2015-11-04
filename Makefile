clean:
	git clean -fxd

install:
	npm install

test: unit-test verify

unit-test:
	mocha tests/poller.spec.js

verify:
	nbt verify --skip-layout-checks

publish:
	@git push origin master && git push origin master --tags
