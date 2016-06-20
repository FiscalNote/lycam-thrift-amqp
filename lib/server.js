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
exports.createAmqpServer = function (processor, _options) {
  var options =  _options || {};
  var transport = (options && options.transport) ? options.transport : TBufferedTransport;
  var protocol = (options && options.protocol) ? options.protocol : TBinaryProtocol;

  this.maxMessages = options.max_messages || 10;

  this.options  = {
    endpoint: options.endpoint ||  'amqp://localhost',
    queueName: options.queueName || 'mytask',
  };

  var onReceiveData = function (ch, data) {

          var fields = data.fields;
          var properties = data.properties;
          var content = data.content;

          // console.log('data', data);

          // console.log('ch', ch);

          transport.receiver(function (transportWithData) {

            var input = new protocol(transportWithData);
            var output = new protocol(new transport(undefined, function (buf) {

                  var options = {
                    routingKey: properties.replyTo,
                    correlationId: properties.correlationId,
                    contentType: 'application/octet-stream',
                  };

                  console.log('options', options);

                  ch.sendToQueue(properties.replyTo,  buf, options);

                }));

            try {
              do {
                processor.process(input, output);
                transportWithData.commitPosition();
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
                console.error('error', err);
                self.emit('error', err);
                // stream.end();
              }
            }

          })(content);

        };

  this.start = function () {
    var self = this;
    return new Promise(function (resolve, reject) {

      var open = amqp.connect(self.options.endpoint);
      var q = self.options.queueName;
      open.then(function (conn) {
        return conn.createChannel();
      }).then(function (ch) {
        if (self.options.prefetch) {

        }

        self.ch = ch;

        console.log('queue', q);

        // console.log('ch', ch);

        return ch.assertQueue(q, {
          autoDelete: true,
        }
          // autoDelete: true,
        ).then(function (ok) {

          console.log('assertQueue', ok);
          return ch.consume(q, function (data) {
            onReceiveData(ch, data);
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

  return this;
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

  return exports.createAmqpServer(new processor(handler), options);
};
