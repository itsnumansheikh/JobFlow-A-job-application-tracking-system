require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per IP per window, across ALL routes
  message: { error: 'Too many requests. Please slow down.' },
});

app.use(globalLimiter);

app.use('/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/auth/' },
}));

app.use('/jobs', createProxyMiddleware({
  target: process.env.JOB_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/jobs/' },
}));

app.use('/applications', createProxyMiddleware({
  target: process.env.APPLICATION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/': '/applications/' },
}));

app.listen(process.env.PORT, () => console.log(`API Gateway running on port ${process.env.PORT}`));