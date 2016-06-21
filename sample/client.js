
var EchoService = require('./gen-nodejs/EchoService');

var ThriftAmqp = require('..');

var uuid = require('node-uuid');

var connection = ThriftAmqp.createConnection({
  connectUrl: 'amqp://127.0.0.1',
  queueName: 'my-service',
});

connection.connect(function () {
  var client = ThriftAmqp.createClient(EchoService, connection);
  function test() {

    var msg = uuid.v1();

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

