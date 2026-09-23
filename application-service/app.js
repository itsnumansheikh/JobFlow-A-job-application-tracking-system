require('dotenv').config();
const express = require('express');
const applicationRoutes = require('./routes/applications');

const app = express();
app.use(express.json());
app.use('/applications', applicationRoutes);

module.exports = app;