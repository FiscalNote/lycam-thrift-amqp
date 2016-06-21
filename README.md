lycam-thrift-amqp

Support for an AMQP transport layer for Apache Thrift

This project implements an AMQP transport layer for Apache Thrift in NodeJS and extends the Apache Thrift tutorial.

Install with:

    npm install lycam-thrift-amqp

## Server example

```javascript

var ThriftAmqp = require('lycam-thrift-amqp');

var EchoService = require('./gen-nodejs/EchoService');


var users = {};

var server = ThriftAmqp.createServer(EchoService, {

  echo: function (msg, result) {
    console.log('msg:', msg);
    var timeout = 100;//Math.random() * 1000 || 0;
    setTimeout(function () {
      return result(null, msg);
    }, timeout);
  },

}, {
  queueName: 'my-service',
  connectUrl: 'amqp://127.0.0.1',
});
// console.log(server);
server.on('connect', function (err, data) {
  console.log('server connected');
});

server.on('call', function (err, data) {
  console.log('server call');
});

server.run();

```
## Client example
```javascript


var EchoService = require('./gen-nodejs/EchoService');

var ThriftAmqp = require('lycam-thrift-amqp');

var connection = ThriftAmqp.createConnection({
  connectUrl: 'amqp://127.0.0.1',
  queueName: 'my-service',
});

connection.connect(function () {
  var client = ThriftAmqp.createClient(EchoService, connection);
  function test() {

    var msg = "hello";

    client.echo(msg, function (err, response) {
      if (err) {
        console.error('error', err);
      } else {
        console.log('echo', msg, response);

      }
    });
  }

  test();
});


```
