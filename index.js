var debug = require('debug')('azure-sb-watcher');
var events = require('events');
var Promise = require('promise');
var queue = require('queue');
var util = require('util');

var AzureSBQueueWatcherJobError = require('./azure-sb-queue-watcher-job-error');

var azureErrors = {
  NO_MORE_MESSAGES: 'No messages to receive'
};

module.exports = AzureSBQueueWatcher;

function AzureSBQueueWatcher(opts) {
  events.EventEmitter.call(this);

  if (!opts.serviceBus) {
    throw new Error('Missing Azure Service Bus Service object `opts.serviceBus`');
  }

  if (opts.queueName === undefined) {
    throw new Error('Missing queue name parameter, `opts.queueName`');
  }

  if (opts.concurrency === undefined) {
    opts.concurrency = 1;
  }

  if (opts.timeout === undefined) {
    opts.timeout = 30 * 1000; // 30 seconds in ms
  }

  this._queueName = opts.queueName;
  this._concurrency = opts.concurrency;

  this._serviceBus = opts.serviceBus;
  this._queue = queue({
    concurrency: opts.concurrency,
    timeout: opts.timeout
  });
  this._running = false;
}

util.inherits(AzureSBQueueWatcher, events.EventEmitter);

AzureSBQueueWatcher.prototype.start = function() {
  this._running = true;

  this._checkQueueExists()
    .then(this._startLoop.bind(this))
    .catch(this._onError.bind(this));
};

AzureSBQueueWatcher.prototype._startLoop = function() {
  debug('Start');

  this._queue.start();
  var concurrency = this._concurrency;

  while (concurrency--) {
    this._getAMessage();
  }

  this._queue.on('success', this._jobDone.bind(this));
  this._queue.on('error', this._onError.bind(this));
  this._queue.on('timeout', this._onJobProcessingTimeout.bind(this));
};

AzureSBQueueWatcher.prototype.stop = function() {
  debug('Stop');

  this._running = false;
  this._queue.stop();
};

AzureSBQueueWatcher.prototype._checkQueueExists = function() {
  debug('Check that queue `%s` exists in Azure', this._queueName);

  var watcher = this;

  var listQueues = Promise.denodeify(this._serviceBus.listQueues.bind(this._serviceBus));

  return listQueues()
    .then(function gotQueueList(remoteQueues) {
      var found = remoteQueues.some(function findQueue(remoteQueue) {
        return remoteQueue.QueueName === watcher._queueName;
      });

      if (found === false) {
        return Promise
          .reject(new Error('Queue `' + watcher._queueName + '` was not found in Azure'));
      }
    });
};

AzureSBQueueWatcher.prototype._jobDone = function(result, job) {
  debug('Job done: %j', job.message);

  this._getAMessage();
};

AzureSBQueueWatcher.prototype._getAMessage = function() {
  if (!this._running) {
    return;
  }

  debug('Asking for a new message');

  this._serviceBus
    .receiveQueueMessage(
      this._queueName,
      {isPeekLock: true},
      this._newMessageReceived.bind(this)
    );
};

AzureSBQueueWatcher.prototype._newMessageReceived = function(err, message) {
  var watcher = this;

  if (err === azureErrors.NO_MORE_MESSAGES) {
    debug('No message in the queue');
    this._getAMessage();
    return;
  }

  if (err) {
    err.job = message;
    this._onError(err);
    return;
  }

  debug('New message: %j', message);

  this._queue.push(job);
  if (!this._queue.running) {
    // this is a synchronous operation
    this._queue.start();
  }

  function job(queueCb) {
    watcher.emit('message', message, userCb);

    function userCb(err) {
      // when receiver sends an error to userCb,
      // we unlock the message for another consumer
      if (err) {
        watcher._serviceBus.unlockMessage(message, queueCb);
        return;
      }

      watcher._serviceBus.deleteMessage(message, queueCb);
    }
  }

  job.message = message;
};

// error cases:
// - this._serviceBus.unlockMessage fails
// - this._serviceBus.deleteMessage fails
// - this._serviceBus.receiveQueueMessage fails
// - job processing timeout (this._queue.on('timeout'))
AzureSBQueueWatcher.prototype._onError = function(err) {
  debug('Error: %s, %j', err.message, err.job);

  this.emit('error', err);
};

AzureSBQueueWatcher.prototype._onJobProcessingTimeout = function(nextJob, failedJob) {
  this._onError(new AzureSBQueueWatcherJobError({
    message: 'Job timeout',
    job: failedJob.message
  }));

  this._serviceBus.unlockMessage(failedJob.message, noop);

  nextJob();
};

function noop() {}
