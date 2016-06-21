
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

