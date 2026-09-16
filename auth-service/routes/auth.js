// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const crypto = require('crypto');


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per IP per window
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});


router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['candidate', 'employer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be candidate or employer' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10); // 10 = "cost factor" — how slow/secure the hash is

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    res.status(201).json({ id: result.insertId, name, email, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});



const jwt = require('jsonwebtoken');

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Deliberately vague error — don't reveal whether it was the email or password that was wrong
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = crypto.randomBytes(40).toString('hex');
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

await pool.query(
  'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
  [user.id, refreshToken, expiresAt]
);

res.json({
  accessToken,
  refreshToken,
  user: { id: user.id, name: user.name, role: user.role },
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});



router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const [rows] = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [refreshToken]
    );
    const stored = rows[0];
    if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const [userRows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [stored.user_id]);
    const user = userRows[0];

    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});



router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});



router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Always respond the same way whether or not the email exists —
    // otherwise attackers can use this endpoint to check which emails are registered
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    );

    // TEMP: return token directly since there's no email service yet.
    // Once Notification Service exists, this becomes: queue an email instead of returning it.
    res.json({ message: 'Reset token generated', resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password required' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [resetToken]
    );
    const record = rows[0];
    if (!record) return res.status(401).json({ error: 'Invalid or expired reset token' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [newHash, record.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [record.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;