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

  echo: function (properties, msg, result) {
    console.log('msg:', msg);
    var timeout = 100;//Math.random() * 1000 || 0;
    setTimeout(function () {
      console.log('messageId:', properties.messageId);
      console.log('timestamp:', properties.timestamp);
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
