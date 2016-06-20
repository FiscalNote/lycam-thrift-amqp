
var thrift = require('thrift');
var Promise = require('bluebird');

var uuid = require('node-uuid');

var amqp = require('amqplib');

var TBufferedTransport = thrift.TBufferedTransport;
var TBinaryProtocol = thrift.TBinaryProtocol;
var TJSONProtocol = thrift.TJSONProtocol;

var InputBufferUnderrunError = thrift.InputBufferUnderrunError;

var binary = thrift.binary;

module.exports = TBufferedTransport;

function TAmqpTransport(client,_options, callback) {

  this.defaultReadBufferSize = 1024;
  this.writeBufferSize = 512; // Soft Limit
  this.inBuf = new Buffer(this.defaultReadBufferSize);
  this.readCursor = 0;
  this.writeCursor = 0; // for input buffer
  this.outBuffers = [];
  this.outCount = 0;
  this.onFlush = callback;
  this.client = client;

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
  this._seqid = 0;
  this.replyQueue = null;

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

        // console.log('queue', q);

        return ch.assertQueue('', {
          exclusive: true,
        }
          // autoDelete: true,
        ).then(function (ok) {
          // console.log('assertQueue', ok);
          self.connected = true;
          self.replyQueue = ok;
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

TAmqpTransport.receiver = function (callback, seqid) {
  var reader = new TAmqpTransport();

  return function (data) {
    if (reader.writeCursor + data.length > reader.inBuf.length) {
      var buf = new Buffer(reader.writeCursor + data.length);
      reader.inBuf.copy(buf, 0, 0, reader.writeCursor);
      reader.inBuf = buf;
    }

    data.copy(reader.inBuf, reader.writeCursor, 0);
    reader.writeCursor += data.length;

    callback(reader, seqid);
  };
};

TAmqpTransport.prototype.commitPosition = function () {
  var unreadSize = this.writeCursor - this.readCursor;
  var bufSize = (unreadSize * 2 > this.defaultReadBufferSize) ?
    unreadSize * 2 : this.defaultReadBufferSize;
  var buf = new Buffer(bufSize);
  if (unreadSize > 0) {
    this.inBuf.copy(buf, 0, this.readCursor, this.writeCursor);
  }

  this.readCursor = 0;
  this.writeCursor = unreadSize;
  this.inBuf = buf;
};

TAmqpTransport.prototype.rollbackPosition = function () {
  this.readCursor = 0;
};

// TODO: Implement open/close support
TAmqpTransport.prototype.isOpen = function () {
  return true;
};

TAmqpTransport.prototype.open = function () {
};

TAmqpTransport.prototype.close = function () {
};

// Set the seqid of the message in the client
// So that callbacks can be found
TAmqpTransport.prototype.setCurrSeqId = function (seqid) {
  this._seqid = seqid;
};

TAmqpTransport.prototype.ensureAvailable = function (len) {
  if (this.readCursor + len > this.writeCursor) {
    throw new InputBufferUnderrunError();
  }
};

TAmqpTransport.prototype.read = function (len) {
  this.ensureAvailable(len);
  var buf = new Buffer(len);
  this.inBuf.copy(buf, 0, this.readCursor, this.readCursor + len);
  this.readCursor += len;
  return buf;
};

TAmqpTransport.prototype.readByte = function () {
  this.ensureAvailable(1);
  return binary.readByte(this.inBuf[this.readCursor++]);
};

TAmqpTransport.prototype.readI16 = function () {
  this.ensureAvailable(2);
  var i16 = binary.readI16(this.inBuf, this.readCursor);
  this.readCursor += 2;
  return i16;
};

TAmqpTransport.prototype.readI32 = function () {
  this.ensureAvailable(4);
  var i32 = binary.readI32(this.inBuf, this.readCursor);
  this.readCursor += 4;
  return i32;
};

TAmqpTransport.prototype.readDouble = function () {
  this.ensureAvailable(8);
  var d = binary.readDouble(this.inBuf, this.readCursor);
  this.readCursor += 8;
  return d;
};

TAmqpTransport.prototype.readString = function (len) {
  this.ensureAvailable(len);
  var str = this.inBuf.toString('utf8', this.readCursor, this.readCursor + len);
  this.readCursor += len;
  return str;
};

TAmqpTransport.prototype.borrow = function () {
  var obj = { buf: this.inBuf, readIndex: this.readCursor, writeIndex: this.writeCursor };
  return obj;
};

TAmqpTransport.prototype.consume = function (bytesConsumed) {
  this.readCursor += bytesConsumed;
};

TAmqpTransport.prototype.write = function (buf) {
  if (typeof (buf) === 'string') {
    buf = new Buffer(buf, 'utf8');
  }

  this.outBuffers.push(buf);
  this.outCount += buf.length;
};

TAmqpTransport.prototype.flush = function(async, callback) {
  // If the seqid of the callback is available pass it to the onFlush
  // Then remove the current seqid
  var seqid = this._seqid;
  
  this._seqid = null;

  var self = this;

  if (this.outCount < 1) {
    return;
  }

  var msg = new Buffer(this.outCount),
      pos = 0;
  this.outBuffers.forEach(function (buf) {
    buf.copy(msg, pos, 0);
    pos += buf.length;
  });

  if (this.isOpen()) {
    //Send data and register a callback to invoke the client callback
    var operation = this.options.operation || '';
    var blocking = this.options.blocking || true;
    var msg_timeout = this.options.msg_timeout || 10;
    var log_messages = this.options.log_messages || false;
    var correlation_id = uuid.v1();

    var headers = {
        service_name: this.options.queueName,
        operation: operation,
        response_required: blocking,
        from_name: this.options.fromName,
      };

    var options = {
      routingKey: this.options.queueName,
      correlationId: correlation_id,
      expiration: msg_timeout,
      replyTo: this.replyQueue.queue,
      headers: headers,
    };

    // console.log('options', options);

    this.ch.consume(this.replyQueue.queue, function (data) {

      

      var fields = data.fields;
      var properties = data.properties;
      var content = data.content;

      var client = self.client;

      // console.log('data', data);

      TBufferedTransport.receiver(function (transportWithData) {
        var message = new TBinaryProtocol(transportWithData);

       
        var header = message.readMessageBegin();
        var dummy_seqid = header.rseqid * -1;

          /*jshint -W083 */
        client._reqs[dummy_seqid] = function(err, success){
          transportWithData.commitPosition();
          var clientCallback = client._reqs[header.rseqid];
          delete client._reqs[header.rseqid];
          if (clientCallback) {
            process.nextTick(function() {
              clientCallback(err, success);
            });
          }
        };

        if(client['recv_' + header.fname]) {
          // console.log("result",header,client['recv_' + header.fname]);
          // console.log("this._reqs[rseqid]",self._reqs[dummy_seqid]);

          client['recv_' + header.fname](message, header.mtype, dummy_seqid);
        } else {
          delete client._reqs[dummy_seqid];
          self.emit("error",
                    new thrift.TApplicationException(thrift.TApplicationExceptionType.WRONG_METHOD_NAME,
                             "Received a response to an unknown RPC function"));
        }
    
              
        // console.log("result",header,client['recv_' + header.fname]);

      })(content);

    });

    this.ch.sendToQueue(this.options.queueName,  msg, options);

  }

  if (this.onFlush) {
    // Passing seqid through this call to get it to the connection
    this.onFlush(msg, seqid);
  }

  this.outBuffers = [];
  this.outCount = 0;
};

module.exports = TAmqpTransport;
