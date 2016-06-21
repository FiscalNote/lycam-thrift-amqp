var _  = require('lodash');
var amqp = require('amqplib');
var Transport = require('./client-transport');
var thrift = require('thrift');

var TBufferedTransport = thrift.TBufferedTransport;
var TBinaryProtocol = thrift.TBinaryProtocol;
var TJSONProtocol = thrift.TJSONProtocol;
var Connection = function (options) {

  this.options =  {
  	connectUrl: 'amqp://localhost',
    queueName: 'lycam-rpc'
  };

  this.transport = Transport;

  this.protocol = this.options.protocol || TBinaryProtocol;
  this.connected = false;


  this.options = _.extend(this.options, options);

  // console.log('this.options',this.options,options);

  this.connect = function (callback) {
    var self = this;
    console.log('connect amqp server:', self.options.connectUrl);

    var open = amqp.connect(self.options.connectUrl);
    open.then(function (conn) {
      self.conn = conn;
      return conn.createChannel();
    }).then(function (ch) {
      self.ch = ch;
      if (callback)
       callback(null, self);
    })
  .catch(function (err) {
      if (callback) {
        console.error(err);
        callback(err);
      }

    });
  };

  return this;
};

module.exports = Connection;
