
var thrift = require('thrift');
var Promise = require('bluebird');

var amqp = require('amqplib');

var TBufferedTransport = thrift.TBufferedTransport;
var TBinaryProtocol = thrift.TBinaryProtocol;
var TJSONProtocol = thrift.TJSONProtocol;

var InputBufferUnderrunError = thrift.InputBufferUnderrunError;

var TAmqpTransport = function (_options) {

  var options =  _options || {};
  var transport = (options && options.transport) ? options.transport : TBufferedTransport;
  var protocol = (options && options.protocol) ? options.protocol : TBinaryProtocol;

  this.maxMessages = options.max_messages || 10;
  this.connected = false;

  this.options  = {
    endpoint:  options.endpoint ||  'amqp://localhost',
    queueName: options.queueName || 'mytask',
    fromName: options.fromName || 'Unknown Client',

  };

  var self = this;


  this.callbacks = [];        //Pending callbacks
  this.send_pending = [];     //Buffers/Callback pairs waiting to be sent
  this.send_buf =  new Buffer('');        //Outbound data, immutable until sent
  this.recv_buf = '';         //Inbound data
  this.rb_wpos = 0;           //Network write position in receive buffer
  this.rb_rpos = 0;           //Client read position in receive buffer
  this._seqid=0;
  
  this.connect =  function () {
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

        return ch.assertQueue('', {
          exclusive: true,
        }
          // autoDelete: true,
        ).then(function (ok) {
          console.log('assertQueue', ok);
          self.connected = true;
          resolve(ok);
          // ch.consume(q, self.onReceiveData);
          // return ch.sendToQueue(q, new Buffer('something to do'));
        });
      })
      .catch(function (err) {
        console.error(err);
        reject(err);
      });
    });
  };

  return this;
};

/**
 * Sends the current WS request and registers callback. The async
 * parameter is ignored (WS flush is always async) and the callback
 * function parameter is required.
 * @param {object} async - Ignored.
 * @param {object} callback - The client completion callback.
 * @returns {undefined|string} Nothing (undefined)
 */
TAmqpTransport.prototype.flush = function (async, callback) {
  var self = this;
  console.log('flush');

  if (this.isOpen()) {
    //Send data and register a callback to invoke the client callback
    var operation = this.options.operation || '';
    var blocking = this.options.blocking || true;
    var msg_timeout = this.options.msg_timeout || 10;
    var log_messages = this.options.log_messages || false;
    // correlation_id = self.generate_uuid

    var headers = {
      service_name: this.options.queueName,
      operation: operation,
      response_required: blocking,
      from_name: this.options.fromName,
    };

    this.ch.sendToQueue(this.options.queueName,  this.send_buf  ,{
      headers: headers,
    });

    
    this.callbacks.push((function () {
      var clientCallback = callback;
      return function (msg) {
        self.setRecvBuffer(msg);
        clientCallback();
      };
    }()));
  } else {
    //Queue the send to go out __onOpen
    this.send_pending.push({
      buf: this.send_buf,
      cb:  callback,
    });
  }
};

TAmqpTransport.prototype.__onOpen = function () {

  var self = this;
  if (this.send_pending.length > 0) {
    //If the user made calls before the connection was fully
    //open, send them now
    this.send_pending.forEach(function (elem) {
      this.socket.send(elem.buf);
      this.callbacks.push((function () {
        var clientCallback = elem.cb;
        return function (msg) {
          self.setRecvBuffer(msg);
          clientCallback();
        };
      }()));
    });

    this.send_pending = [];
  }
};

TAmqpTransport.prototype.__onClose = function (evt) {
  this.__reset(this.url);
};

TAmqpTransport.prototype.__onMessage = function (evt) {
  if (this.callbacks.length) {
    this.callbacks.shift()(evt.data);
  }
};

TAmqpTransport.prototype.__onError = function (evt) {
  console.log('Thrift WebSocket Error: ' + evt.toString());
  this.socket.close();
};

/**
 * Sets the buffer to use when receiving server responses.
 * @param {string} buf - The buffer to receive server responses.
 */
TAmqpTransport.prototype.setRecvBuffer = function (buf) {
  this.recv_buf = buf;
  this.recv_buf_sz = this.recv_buf.length;
  this.wpos = this.recv_buf.length;
  this.rpos = 0;
};

/**
 * Returns true if the transport is open
 * @readonly
 * @returns {boolean}
 */
TAmqpTransport.prototype.isOpen = function () {
  return this.connected;
};

/**
 * Opens the transport connection
 */
TAmqpTransport.prototype.open = function () {

  console.log('__onOpen');
  //If OPEN/CONNECTING/CLOSING ignore additional opens
  if (this.socket && this.socket.readyState != this.socket.CLOSED) {
    return;
  }
  //If there is no socket or the socket is closed:
  this.socket = new WebSocket(this.url);
  this.socket.onopen = this.__onOpen.bind(this);
  this.socket.onmessage = this.__onMessage.bind(this);
  this.socket.onerror = this.__onError.bind(this);
  this.socket.onclose = this.__onClose.bind(this);
};

/**
 * Closes the transport connection
 */
TAmqpTransport.prototype.close = function () {
  this.socket.close();
};

/**
 * Returns the specified number of characters from the response
 * buffer.
 * @param {number} len - The number of characters to return.
 * @returns {string} Characters sent by the server.
 */
TAmqpTransport.prototype.read = function (len) {
  var avail = this.wpos - this.rpos;

  if (avail === 0) {
    return '';
  }

  var give = len;

  if (avail < len) {
    give = avail;
  }

  var ret = this.read_buf.substr(this.rpos, give);
  this.rpos += give;

  //clear buf when complete?
  return ret;
};

/**
 * Returns the entire response buffer.
 * @returns {string} Characters sent by the server.
 */
TAmqpTransport.prototype.readAll = function () {
  return this.recv_buf;
};

/**
 * Sets the send buffer to buf.
 * @param {string} buf - The buffer to send.
 */
TAmqpTransport.prototype.write = function (buf) {
	console.log('buf',buf,typeof buf);
	this.send_buf.write(buf);
  	// this.send_buf = buf;
};

/**
 * Returns the send buffer.
 * @readonly
 * @returns {string} The send buffer.
 */
TAmqpTransport.prototype.getSendBuffer = function () {
  return this.send_buf;
};
  // Set the seqid of the message in the client
  // So that callbacks can be found
TAmqpTransport.prototype.setCurrSeqId = function(seqid) {
  this._seqid = seqid;
};

module.exports = TAmqpTransport;
