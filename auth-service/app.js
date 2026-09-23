require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});

module.exports = app;