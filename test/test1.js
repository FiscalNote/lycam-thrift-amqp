'use strict';
var ThriftAmqp = new require('..')({});

var result;
describe('connect', function () {
  beforeEach(function (done) {

    // thriftAmqp = new ThriftAmqp();
    // result = thriftAmqp;
    console.log(ThriftAmqp.server);
    ThriftAmqp.server.start()
    .then(function (data) {
      done();
    });

  });

  it('returns an access token as result of callback api', function () {
    console.log(result);
    result.should.have.property('connect');
  });

});
