const amqp = require('amqplib');
const pool = require('./db');

async function startConsumer() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  const queue = 'application_created';

  await channel.assertQueue(queue, { durable: true });
  console.log('Notification service listening on queue:', queue);

  channel.consume(queue, async (msg) => {
    if (msg === null) return;

    try {
      const data = JSON.parse(msg.content.toString());
      console.log('Received application event:', data);

      // Look up the job + employer so we know who to notify
      const [rows] = await pool.query(
        `SELECT jobs.title, companies.owner_user_id 
         FROM jobs JOIN companies ON jobs.company_id = companies.id 
         WHERE jobs.id = ?`,
        [data.job_id]
      );
      const job = rows[0];

      if (job) {
        const message = `New application received for "${job.title}"`;
        await pool.query(
          'INSERT INTO notifications (user_id, message, is_read) VALUES (?, ?, ?)',
          [job.owner_user_id, message, false]
        );
        console.log('Notification saved for user', job.owner_user_id, ':', message);
      }

      channel.ack(msg); // tell RabbitMQ this message was successfully handled
    } catch (err) {
      console.error('Failed to process message:', err);
      channel.nack(msg, false, true); // requeue on failure instead of losing it
    }
  });
}

module.exports = { startConsumer };