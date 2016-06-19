var thrift = require('thrift');

var AccountService = require('./gen-nodejs/AccountService');
var ttypes = require('./gen-nodejs/Account_types');

var ThriftAmqp = new require('..')({});


var protocol = thrift.TBinaryProtocol;
// var protocol = thrift.TJSONProtocol;



var transport = new ThriftAmqp.transport({});


var client = new AccountServiceClient(transport,protocol);

transport.connect()
.then(function(data){
	console.log(data);
	client.balance('user');
})
.catch(function(err){
	console.error(err);
})
// client.balance('user');