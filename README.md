# Azure SB Queue Watcher
[![Dependency Status](http://img.shields.io/david/vvo/azure-sb-queue-watcher.svg?style=flat-square)](https://david-dm.org/vvo/azure-sb-queue-watcher) [![devDependency Status](http://img.shields.io/david/dev/vvo/azure-sb-queue-watcher.svg?style=flat-square)](https://david-dm.org/vvo/azure-sb-queue-watcher#info=devDependencies)

Job worker around Azure Service Bus Queues. It exposes a clean interface to watch for messages
in a failsafe way.

[Azure/azure-sdk-for-node](https://github.com/Azure/azure-sdk-for-node) does not exposes
a simple way to watch for messages and mark them as completed.

This is the reason to exist of this module.

## Install

```js
npm install azure-sb-queue-watcher --save
```

## Example

```js
var azure = require('azure');
var AzureSBQueueWatcher = require('azure-sb-queue-watcher');

var myServiceBus = azure.createServiceBusService();
var watcher = new AzureSBQueueWatcher({
  serviceBus: myServiceBus,
  queueName: 'hello'
});

watcher.on('message', console.log);
watcher.on('error', console.error);
```

## API

### var watcher = new AzureSBQueueWatcher(opts)

`opts.serviceBus` is required and must be a [ServiceBusService object](https://github.com/Azure/azure-sdk-for-node/blob/faba861ffa6bb09cba8c294d10a34ced9bdcd7fa/lib/services/serviceBus/lib/servicebusservice.js#L68).

You usually create them like this:

```js
var azure = require('azure');
var serviceBusService = azure.createServiceBusService();
```

`opts.queueName` is the service bus queue name you want to watch.

`opts.concurrency` is the number of messages you want to get from the queue at once. It defaults
to `1`. It all depends on how much messages you can deal with given you CPU power.

`opts.timeout` is the message processing timeout (in ms). After this timeout, the message is released to be consumed by others.

### watcher.start()

Start watching for messages.

### watcher.stop()

Stop watching for messages.

### watcher.on('message', message, done)

New message arrived.

`message` contains the original azure service bus queue message.

`done` is a callback you must call when you have finished dealing with the message.
You must call `done`.

### watcher.on('error')

Emitted when an error occurs. Error cases:

- [ServiceBusService.unlockMessage](https://github.com/Azure/azure-sdk-for-node/blob/faba861ffa6bb09cba8c294d10a34ced9bdcd7fa/lib/services/serviceBus/lib/servicebusservice.js#L322-L353) fails
- [ServiceBusService.deleteMessage](https://github.com/Azure/azure-sdk-for-node/blob/faba861ffa6bb09cba8c294d10a34ced9bdcd7fa/lib/services/serviceBus/lib/servicebusservice.js#L289-L320) fails
- [ServiceBusService.receiveQueueMessage](https://github.com/Azure/azure-sdk-for-node/blob/faba861ffa6bb09cba8c294d10a34ced9bdcd7fa/lib/services/serviceBus/lib/servicebusservice.js#L209-L241) fails
- job processing timeout (this._queue.on('timeout'))

