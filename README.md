lycam-thrift-amqp

Support for an AMQP transport layer for Apache Thrift

This project implements an AMQP transport layer for Apache Thrift in NodeJS and extends the Apache Thrift tutorial.


## Server example

```javascript

var ThriftAmqp = new require('..')({});

var AccountService = require('./gen-nodejs/AccountService.js'),
    ttypes = require('./gen-nodejs/Account_types');

var users = {};

var server = ThriftAmqp.server.createServer(AccountService, {

  balance: function (user, result) {
    console.log('balance:', user);
    var timeout = 100;//Math.random() * 1000 || 0;
    setTimeout(function () {
      return result(null, parseFloat(user));
    }, timeout);
  },

}, {
  queueName: 'my-service',
});
// console.log(server);
server.on('connect',function(err,data){
	console.log('server connected');
})
server.on('call',function(err,data){
	console.log('server call');
})
server.run();

```
## Client example
```javascript


var AccountService = require('./gen-nodejs/AccountService');
var ttypes = require('./gen-nodejs/Account_types');
var ThriftAmqp = new require('..')({});

var uuid = require('node-uuid');

var connection = ThriftAmqp.createConnection({
  connectUrl: 'amqp://127.0.0.1',
  queueName: 'my-service',
});

connection.connect(function () {
  var client = ThriftAmqp.createClient(AccountService, connection);
  function test() {
    var user = Math.random() + '';
    var balance = client.balance(user, function (err, response) {
      if (err) {
        console.error('error', err);
      } else {
        console.log('balance', user, response);

      }
    });
  }

  test();
});

```
