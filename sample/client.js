var thrift = require('thrift');

var AccountService = require('./gen-nodejs/AccountService');
var ttypes = require('./gen-nodejs/Account_types');

var ThriftAmqp = new require('..')({});

var protocol = thrift.TBinaryProtocol;
// var protocol = thrift.TJSONProtocol;
var uuid = require('node-uuid');
var transport = new ThriftAmqp.transport(null, {});

var client = new AccountServiceClient(transport, protocol);
transport.client = client;

transport.connect()
.then(function (data) {
  console.log(data);

  function test() {
    var user = Math.random() + '';
    var balance = client.balance(user, function (err, response) {
      if (err) {
        console.error("error",err);
      } else {
        console.log('balance', user, response);

      }
    });
  }

  setInterval(function () {
    test();
  }, 200);

})
.catch(function (err) {
  console.error(err);
});
// client.balance('user');
