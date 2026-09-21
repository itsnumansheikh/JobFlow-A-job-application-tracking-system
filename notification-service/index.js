require('dotenv').config();
const { startConsumer } = require('./consumer');

startConsumer().catch((err) => {
  console.error('Failed to start consumer:', err);
  process.exit(1);
});

console.log(`Notification service starting (no HTTP server needed — this is a background worker)`);