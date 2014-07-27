
all:
	mkdir -p ./target

build: all 
	./node_modules/.bin/browserify -t debowerify -e src/poller.js -o target/poller.js -s Poller 

test: all 
	./node_modules/.bin/mocha tests/poller.spec.js

dist: test build
	cp target/poller.js dist/poller.js
	./node_modules/.bin/uglifyjs -o dist/poller.min.js dist/poller.js
