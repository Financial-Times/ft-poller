
test: 
	./node_modules/.bin/mocha tests/poller.spec.js

publish:
	@git push origin master && git push origin master --tags
