// index.js
require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');


const app = require('./app');
app.use(express.json());
app.use('/auth', authRoutes);

app.listen(process.env.PORT, () => console.log(`Auth service running on port ${process.env.PORT}`));

const { requireAuth, requireRole } = require('./middleware/auth');

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({ message: 'You are authenticated', user: req.user });
});