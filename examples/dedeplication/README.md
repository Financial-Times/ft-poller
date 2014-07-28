
This demonstrates how you can use Poller to dedeplicate lists of things
fetched independently from the server. 

## Usage

Install the dependencies then fire up the server and client,
    
    npm install express
    node server.js & node client.js

## About

The client fetches (from the server) three lists of 'headlines' are irregular
intervals.

Every second three separate lists of 'headlines' are merged, de-deplicated and
printed to the terminal, Eg. 

    [ 1, 2, 3, 4, 7 ]
    [ 1, 2, 4, 5, 7 ]
    [ 1, 2, 3, 7, 9 ]
    [ 1, 2, 3, 7, 9 ]
    [ 1, 2, 3, 4, 6, 9 ]
    [ 1, 2, 3, 4, 6, 9 ]

