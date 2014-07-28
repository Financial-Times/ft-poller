
Scheduled, asynchronous JSON fetching for Node.js applications.

### Background

The classic request cycle for a web application follows a call from a client
to the server, which in turn makes one or more further requests to some
underlying service(s). 

                                    +---> Web service 1 --> Data 
                                    |       
    Client ---> Presentation tier --|---> Web service 2 --> Data
                                    |   
                                    +---> Web service 3 --> Data

Once the data has been retrieved the response makes it's way back through the
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

### Usage

Install it,

    npm install ft-poller

You can create an instance of Poller like so,

    // Nb. do `npm install es6-promise` if running node < 11.x 
    GLOBAL.Promise = require('es6-promise').Promise;

    var Poller = require('ft-poller'),
        response;

    var p = new Poller({
        url: 'http://www.example.com/foo', 
        refreshInterval: 2000,
        parseData: function (data) {
            response = data;
        }
    });

    p.on('error', function (err) {
        console.error(err)
    })

This will fire a request every 2s to example.com/foo and cache the result
in _response_. 

You can start polling like so,

    p.start()
    
And stop it like this,

    p.stop()

Sometimes you don't want to wait the _refreshInterval_ to have your data
populated, so passing _initialRequest: true_ will fire the first request as
soon as the object is created, and then afterwards, at every refresh interval. 

    p.start({ initialRequest: true });

### Events

Given the asynchronous nature of this library, events might provide a simple
interface to attach other async code to.

#### Ok

This fires each time the polling mechanism has successfully received a repsonse
from it's source. Eg, 

    var p = new Poller({ url: 'http://example.com/123' })

    p.on('ok', function (response, latency) {
        // ... 
    })

#### Error

This fires each time the polling mechanism fails, passing the error as an
argument. Eg, 

    p.on('error', function (response) {
        // ... 
    })

