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

var ThriftAmqp = require('..');

var EchoService = require('./gen-nodejs/EchoService');


var users = {};

var server = ThriftAmqp.createServer(EchoService, {

  echo: function (msg, result) {
    // The properties for the message must be read and saved immediately
    // since they will be overwritten as soon as another message is processed
    // which could happen as soon as we exit this function.
    var last_properties = server.last_properties;
    console.log('msg:', msg);
    var timeout = 100;//Math.random() * 1000 || 0;
    setTimeout(function () {
      console.log('messageId:', last_properties.messageId);
      console.log('timestamp:', last_properties.timestamp);
      return result(null, msg);
    }, timeout);
  },

}, {
  queueName: 'my-service',
  connectUrl: 'amqp://127.0.0.1',
});
// console.log(server);
server.on('connect', function (err, data) {
  console.log('server connected');
});

server.on('call', function (err, data) {
  console.log('server call');
});

server.run();
