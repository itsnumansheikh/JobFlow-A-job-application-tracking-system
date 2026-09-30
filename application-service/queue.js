const amqp = require('amqplib');

let connection;
let channel;

async function connectQueue() {
  const host = process.env.RABBITMQ_HOST || 'localhost';
  connection = await amqp.connect(`amqp://${host}`);
  channel = await connection.createChannel();
  await channel.assertQueue('application_created', { durable: true });
  console.log('Connected to RabbitMQ, queue ready');
}

function publishApplicationCreated(data) {
  if (!channel) throw new Error('Queue channel not ready');
  channel.sendToQueue('application_created', Buffer.from(JSON.stringify(data)), { persistent: true });
}

async function closeQueue() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connectQueue, publishApplicationCreated, closeQueue };