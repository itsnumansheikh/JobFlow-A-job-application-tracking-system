const amqp = require('amqplib');

let connection;
let channel;

async function connectQueue(retries = 10, delayMs = 3000) {
  const host = process.env.RABBITMQ_HOST || 'localhost';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      connection = await amqp.connect(`amqp://${host}`);
      channel = await connection.createChannel();
      await channel.assertQueue('application_created', { durable: true });
      console.log('Connected to RabbitMQ, queue ready');
      return;
    } catch (err) {
      console.log(`RabbitMQ not ready yet (attempt ${attempt}/${retries}), retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Could not connect to RabbitMQ after multiple attempts');
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