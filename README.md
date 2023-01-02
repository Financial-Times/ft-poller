
Scheduled, asynchronous JSON fetching for Node.js applications. [Background](#background);

### installation

```
npm install ft-poller
```

### API
You can create an instance of Poller like so,

```
var Poller = require('ft-poller');
var p = new Poller(config);
```

Where `config` is an object with the following properties

* `url` [required]: Url to fetch data from
* `defaultData` [recommended]: Data to return if the poller is yet to make a successful request. Typically this will be an empty object of the same type/structure as a successful response e.g. if a successful response would give you an array of users then set `defaultData: []`
* `options` [optional]: options object to pass to isomorphic-fetch. If options is not defined or doesn't contain a `timeout` property, request timeout will be set to 4000ms by default. If `retry` is specified then n-eager-fetch is used to send the request instead of fetch
* `refreshInterval` [default: 60000]: Number of milliseconds to wait between request for data
* `autostart` [default: false]: Whether to start the poller automatically when the instance is created
* `parseData` [optional]: function to post-process the data returned by the request. Should return the post-processed data e.g
```
parseData: function (data) {
    return data.rows;
}
```

`parseData` can be any function you like and there's nothing to stop you using it to mutate any other variables in scope.


#### methods

* `start()` - Starts the poller. If passed an object `{ initialRequest: true }` it will send its first request immediately, otherwise it will wait until `config.refreshInterval` milliseconds. Returns a promise for the result of the first request (if `initialRequest` is true), or an empty resolved Promise otherwise

* `stop()` - Stops polling

* `getData()` - Returns the last set of data retrieved from the server (post-processed if `parseData` function exists). This will throw an `HttpError` if the most recent fetch received an error.

#### Events

* `error` - emits an error whenever a request returns with an error
* `ok` - emits the response whenever a request returns successfully


### Background

The classic request cycle for a web application follows a call from a client
to the server, which in turn makes one or more further requests to some
underlying service(s).

                                    +---> Web service 1 --> Data
                                    |
    Client ---> Presentation tier --|---> Web service 2 --> Data
                                    |
                                    +---> Web service 3 --> Data

Once the data has been retrieved the response makes its way back through the
various layers to the client.

This causes two problems.

Firstly, your response is dependent on the slowest service to respond. If every
request is hanging around waiting for 'the slow one' your performance is pegged
to the worst performing part of your application.

Secondly, by far the slowest thing in this type of architecture is the
round-trip between the presentation tier and the service(s). The more of these
open connections you have hanging around, waiting to close, the greater the
burden you place on your server.

#### Async

Often though, and this is especially true of News sites, the data doesn't
change radically from second to second so this round trip is wasted effort.

It's much more efficient for each presentation tier server to periodically
fetch the data it needs (or listen for a message to signal when new content is
available), stash it in memory, then use that to service any incoming requests.

This suits a [microservice
architecture](http://martinfowler.com/articles/microservices.html), where many
discrete modules, APIs etc. need to be assembled by a presentation tier before
being rendered out to the client (as HTML, JSON etc.).

This pattern (of asynchronous fetching) allows the presentation tier to focus on
building a response from existing data (in memory) and sending it back out the
front door as quickly as possible.
test
