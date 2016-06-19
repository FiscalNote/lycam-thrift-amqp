var Transport = require('./client-transport');
var server = require('./server');

var thriftAmqp = function(options){
	this.connect = function () {};
	this.server = server;
	this.transport = Transport;
	return this;
}


module.exports = function (options) {
  return new thriftAmqp(options);
};
