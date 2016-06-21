var Transport = require('./client-transport');
var server = require('./server');
var Connection = require('./connection');

var thriftAmqp = function (options) {
  this.connect = function () {};

  this.server = server;
  this.transport = Transport;




  // var client = thrift.createClient(helloSvc, connection);

  return this;
};

thriftAmqp.prototype.createConnection = function (options) {
		var opts = options || {};
		var conn = new Connection(opts);
		return conn;
};

thriftAmqp.prototype.createClient = function (ServiceClient, connection) {
  // TODO validate required options and throw otherwise
  if (ServiceClient.Client) {
    ServiceClient = ServiceClient.Client;
  }
  // TODO detangle these initialization calls
  // creating "client" requires
  //   - new service client instance
  //
  // New service client instance requires
  //   - new transport instance
  //   - protocol class reference
  //
  // New transport instance requires
  //   - Buffer to use (or none)
  //   - Callback to call on flush

  // Wrap the write method

  var transport = new Transport(undefined, {
    queueName: connection.options.queueName,
  });

  var client = new ServiceClient(transport, connection.protocol);
  transport.client = client;
  transport.connection = connection;
  connection.client = client;
  transport.ch = connection.ch;

  return client;
};

module.exports = function (options) {
  return new thriftAmqp(options);
};
