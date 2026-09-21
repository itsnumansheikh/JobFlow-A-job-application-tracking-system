const amqp = require('amqplib');

let channel;

async function connectQueue() {
  const connection = await amqp.connect('amqp://localhost');
  channel = await connection.createChannel();
  await channel.assertQueue('application_created', { durable: true });
  console.log('Connected to RabbitMQ, queue ready');
}

function publishApplicationCreated(data) {
  if (!channel) throw new Error('Queue channel not ready');
  channel.sendToQueue('application_created', Buffer.from(JSON.stringify(data)), { persistent: true });
}

module.exports = { connectQueue, publishApplicationCreated };