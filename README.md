
Scheduled, async content fetching for Node.js applications.

### Background

The classic request cycle for a web application follows a request from a client
to the server, which in turn makes one or more further requests to some
underlying service. 

                                    +---> Web service 1 --> Data 
                                    |       
    Client ---> Presentation tier --|---> Web service 2 --> Data
                                    |   
                                    +---> Web service 3 --> Data

Once the data has been fished out, the response makes it's way back through the
various layers to the client. 

This causes two problems.

Firstly, your response is dependent on the slowest service to respond. If every
request is hanging around waiting for 'the slow one' you are going only ever
going to perform at the slowest speed.

Secondly, by far the slowest thing in this type of architecture is the
roundtrip between the presentation tier and the service(s). The more of these
you have hanging around, waiting for connections to close, the greater the
burden you place on your server.

#### Async

Often though, and this is especially true of News sites, the data doesn't
change radically from second to second so this round trip is wasted effort. 

It's much more efficient for each presentation tier server to periodically
fetch the data it needs (or listen for a message to signal when new content is
available), stash it in memory then use that to service any incoming requests.

### Usage

Install it,

    npm install ft-poller

You can create an instance of Poller like so,

    var Poller = require('ft-poller'),
        response;

    var p = new Poller({
        url: 'http://www.example.com/foo' 
        refreshInterval: 2000,
        parseData: function (data) {
            response = data;
        }
    });

This will fire a request every 2s to example.com/foo and cache the result
in _response_. 

You can start polling like so,

    p.start()
    
And stop it like this,

    p.stop()

Sometimes you don't want to wait the refreshInterval to have your data
populated, so passing _initialRequest: true_ will fire the first request as
soon as the object is created, and then afterwards, at every refresh interval. 

    p.start({ initialRefresh: true });

