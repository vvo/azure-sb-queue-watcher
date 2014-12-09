module.exports = AzureSBQueueWatcherJobError;

var util = require('util');

function AzureSBQueueWatcherJobError(opts) {
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);

  this.name = this.constructor.name;
  this.message = opts.message;
  this.job = opts.job;
}

util.inherits(AzureSBQueueWatcherJobError, Error);
