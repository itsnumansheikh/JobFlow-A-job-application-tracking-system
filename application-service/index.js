require('dotenv').config();
const express = require('express');
const applicationRoutes = require('./routes/applications');
const { connectQueue } = require('./queue');

const app = require('./app');
app.use(express.json());
app.use('/applications', applicationRoutes);

connectQueue().then(() => {
  app.listen(process.env.PORT, () => console.log(`Application service running on port ${process.env.PORT}`));
});