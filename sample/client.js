var thrift = require('thrift');

var AccountService = require('./gen-nodejs/AccountService');
var ttypes = require('./gen-nodejs/Account_types');

var ThriftAmqp = new require('..')({});

var protocol = thrift.TBinaryProtocol;
// var protocol = thrift.TJSONProtocol;

var transport = new ThriftAmqp.transport(null, {});

var client = new AccountServiceClient(transport, protocol);
transport.client = client;

transport.connect()
.then(function (data) {
  console.log(data);
  setInterval(function () {
    var balance = client.balance('user-abcd', function (err, response) {
      if (err) {
        console.error(err);
      } else {
        console.log('balance', response);
      }
    });
  }, 10);

})
.catch(function (err) {
  console.error(err);
});
// client.balance('user');
