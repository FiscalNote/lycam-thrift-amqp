'use strict';
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var thrift = require('thrift');
var Promise = require('bluebird');
var amqp = require('amqplib');

var util = require('util');
var events = require('events');//EventEmitter通过events模块来访问

var TBufferedTransport = thrift.TBufferedTransport;
var TBinaryProtocol = thrift.TBinaryProtocol;
var TJSONProtocol = thrift.TJSONProtocol;
var Transport = require('./client-transport');

var InputBufferUnderrunError = thrift.InputBufferUnderrunError;
/**
 * Create a Thrift server which can serve one or multiple services.
 * @param {object} processor - A normal or multiplexedProcessor (must
 *                             be preconstructed with the desired handler).
 * @param {ServerOptions} options - Optional additional server configuration.
 * @returns {object} - The Apache Thrift Multiplex Server.
 */

function AMQPServer(processor, handler, _options) {

  var self = this;

  events.EventEmitter.call(this);

  var options =  _options || {};
  this.transport = (options && options.transport) ? options.transport : TBufferedTransport;
  this.protocol = (options && options.protocol) ? options.protocol : TBinaryProtocol;

  this.maxMessages = options.max_messages || 10;
  this.processor = processor;
  this.handler = handler;

  this.options  = {
    connectUrl: options.connectUrl ||  'amqp://localhost',
    queueName: options.queueName || 'lycam-rpc',
    doAck: options.doAck === undefined ? true : options.doAck
  };

  return this;
};

util.inherits(AMQPServer, events.EventEmitter);//使这个类继承EventEmitter

exports.AMQPServer = AMQPServer;

/**
 *  Adds the returned properties as an argument to the original handler function
 * @param {Object}  baseHandler  the handler passed in
 * @param {Object}  properties   RMQ properties when invoked as the first argument
 */
const createPropertiesHandler = function(baseHandler, properties) {
  const propertiesHandler = {};
  for (const method in baseHandler) {
    propertiesHandler[method] = function() {
      if (arguments && arguments.length && typeof arguments[arguments.length - 1] === 'function') {
        const lastArg = arguments[arguments.length - 1];
        const argsExceptLast = Array.prototype.slice.call(arguments, 0, -1);
        // place properties before the callback function
        baseHandler[method].apply(baseHandler, argsExceptLast.concat([properties, lastArg]));
      } else {
        // since there is no callback,
        // place properties at the end of the list of args
        baseHandler[method].apply(baseHandler, Array.prototype.slice.call(arguments).concat([properties]));
      }
    }
  }
  return propertiesHandler;
};

AMQPServer.prototype.onReceiveData = function (ch, data) {
          var self = this;

          var fields = data.fields;
          var properties = data.properties;
          var content = data.content;

          // console.log('data', data);

          // console.log('ch', ch);
          var transport = self.transport;
          var protocol = self.protocol;
          var processor = new self.processor(createPropertiesHandler(self.handler, data.properties));

          self.emit('call', data);

          self.transport.receiver(function (transportWithData) {

            var input = new protocol(transportWithData);
            var output = new protocol(new transport(undefined, function (buf) {

                  var options = {
                    routingKey: properties.replyTo,
                    correlationId: properties.correlationId,
                    contentType: 'application/octet-stream',
                  };

                  // console.log('options', options);

                  ch.sendToQueue(properties.replyTo,  buf, options);

                }));

            try {
              do {
                processor.process(input, output);
                transportWithData.commitPosition();
                if (self.options.doAck) {
                  ch.ack(data);
                }
              } while (true);
            } catch (err) {
              // console.error('error', err);

              if (err.name ==  'InputBufferUnderrunError') {
                //The last data in the buffer was not a complete message, wait for the rest
                transportWithData.rollbackPosition();
              } else if (err.message === 'Invalid type: undefined') {
                //No more data in the buffer
                //This trap is a bit hackish
                //The next step to improve the node behavior here is to have
                //  the compiler generated process method throw a more explicit
                //  error when the network buffer is empty (regardles of the
                //  protocol/transport stack in use) and replace this heuristic.
                //  Also transports should probably not force upper layers to
                //  manage their buffer positions (i.e. rollbackPosition() and
                //  commitPosition() should be eliminated in lieu of a transport
                //  encapsulated buffer management strategy.)
                transportWithData.rollbackPosition();
              } else {
                //Unexpected error
                // console.error('error', err);
                self.emit('error', err);
                // stream.end();
              }
            }

          })(content);

        };

AMQPServer.prototype.run = function () {
    var self = this;

    return new Promise(function (resolve, reject) {

      var open = amqp.connect(self.options.connectUrl);
      var q = self.options.queueName;
      open.then(function (conn) {
        return conn.createChannel();
      }).then(function (ch) {
        if (self.options.prefetch) {

        }

        self.emit('connect', ch);

        self.ch = ch;

        // console.log('queue', q);

        // console.log('ch', ch);

        return ch.assertQueue(q, {
          autoDelete: false,
        }
          // autoDelete: true,
        ).then(function (ok) {

          // console.log('assertQueue', ok);
          return ch.consume(q, function (data) {
            self.onReceiveData(ch, data);
          });
          // return ch.sendToQueue(q, new Buffer('something to do'));
        });
      })
      .then(function (data) {
        console.log('consume:', data);
        resolve(data);
      })
      .catch(function (err) {
        console.error(err);

        reject(err);
      });

      // Create a channel to the service queue
      // @request_channel = @conn.create_channel(nil, max_messages )
      // @request_channel.prefetch(options[:prefetch]) if options[:prefetch]

      // @request_queue = @request_channel.queue(@queue_name, :auto_delete => true)

      // @request_queue.subscribe(:block => true) do |delivery_info, properties, payload|
    });
  };



/**
 * Create a single service Apache Thrift server.
 * @param {object} processor - A service class or processor function.
 * @param {ServerOptions} options - Optional additional server configuration.
 * @returns {object} - The Apache Thrift Multiplex Server.
 */
exports.createServer = function (processor, handler, options) {
  if (processor.Processor) {
    processor = processor.Processor;
  }

  return new AMQPServer(processor, handler, options);
};
