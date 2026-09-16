const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Create a job posting — employer only
router.post('/', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { company_id, title, description } = req.body;

    if (!company_id || !title) {
      return res.status(400).json({ error: 'company_id and title are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO jobs (company_id, title, description, status) VALUES (?, ?, ?, ?)',
      [company_id, title, description || null, 'open']
    );

    res.status(201).json({ id: result.insertId, company_id, title, description, status: 'open' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// List jobs — public, with pagination and optional search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    let query = 'SELECT * FROM jobs WHERE status = "open"';
    const params = [];

    if (search) {
      query += ' AND title LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    res.json({ page, limit, results: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});


router.patch('/:id', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const jobId = req.params.id;
    const { title, description, status } = req.body;

    // First, check the job exists and belongs to a company this employer owns
    const [jobRows] = await pool.query(
      `SELECT jobs.*, companies.owner_user_id 
       FROM jobs 
       JOIN companies ON jobs.company_id = companies.id 
       WHERE jobs.id = ?`,
      [jobId]
    );
    const job = jobRows[0];

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this job posting' });
    }

    await pool.query(
      'UPDATE jobs SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status) WHERE id = ?',
      [title || null, description || null, status || null, jobId]
    );

    res.json({ message: 'Job updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});


router.delete('/:id', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const jobId = req.params.id;

    const [jobRows] = await pool.query(
      `SELECT jobs.*, companies.owner_user_id 
       FROM jobs 
       JOIN companies ON jobs.company_id = companies.id 
       WHERE jobs.id = ?`,
      [jobId]
    );
    const job = jobRows[0];

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this job posting' });
    }

    await pool.query('DELETE FROM jobs WHERE id = ?', [jobId]);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;