var Transport = require('./client-transport');
var server = require('./server');
var Connection = require('./connection');


exports.createServer  = require('./server').createServer;



exports.createConnection = function (options) {
		var opts = options || {};
		var conn = new Connection(opts);
		return conn;
};

exports.createClient = function (ServiceClient, connection, transportOptions = {}) {
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


  /* transportOptions supports
   * messageTtl: number - in ms (defaults to 10ms),
   * messageBlocking: boolean - (defaults to true, waits for ack from consumers then timeout/drops message),
   * logMessages: boolean - (defaults to false, logs messages)
   */

  var options =  Object.assign({
    queueName: connection.options.queueName
  }, transportOptions);

  var transport = new Transport(undefined, options);

  var client = new ServiceClient(transport, connection.protocol);
  transport.client = client;
  transport.connection = connection;
  connection.client = client;
  transport.ch = connection.ch;

  return client;
};

