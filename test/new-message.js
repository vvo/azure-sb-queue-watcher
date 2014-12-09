var test = require('tape');

test('new message', function(t) {
  t.plan(3);

  var azure = require('azure');
  var AzureSBQueueWatcher = require('../');

  var expectedMessage = {
    body: 'Hello',
    customProperties: {
      world: true
    }
  };

  var serviceBus1 = azure.createServiceBusService();
  var serviceBus2 = azure.createServiceBusService();
  var watcher = new AzureSBQueueWatcher({
    serviceBus: serviceBus1,
    queueName: process.env.QUEUE_NAME
  });

  serviceBus2.sendQueueMessage(
    process.env.QUEUE_NAME,
    expectedMessage,
    function messageSent(err) {
      t.error(err, 'No error while sending a message');
    });

  watcher.on('message', function newMessage(receivedMessage, done) {
    t.pass('Received a `message` event');

    t.deepEqual(expectedMessage, {
      body: receivedMessage.body,
      customProperties: receivedMessage.customProperties
    }, 'Received message matches sent message');

    setTimeout(done, 50);
    setTimeout(watcher.stop.bind(watcher), 60);
  });

  watcher.start();
});
