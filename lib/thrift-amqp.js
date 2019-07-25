var Transport = require('./client-transport');
var server = require('./server');
var Connection = require('./connection');


exports.createServer  = require('./server').createServer;



exports.createConnection = function (options) {
		var opts = options || {};
		var conn = new Connection(opts);
		return conn;
};

exports.createClient = function (ServiceClient, connection) {
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



  var transport = new Transport(undefined, {
    queueName: connection.options.queueName,
    tempQueuePrefix: connection.options.tempQueuePrefix
  });

  var client = new ServiceClient(transport, connection.protocol);
  transport.client = client;
  transport.connection = connection;
  connection.client = client;
  transport.ch = connection.ch;

  return client;
};

