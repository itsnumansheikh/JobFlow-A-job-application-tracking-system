const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Candidate applies to a job
router.post('/', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id is required' });

    const [jobRows] = await pool.query('SELECT * FROM jobs WHERE id = ?', [job_id]);
    const job = jobRows[0];

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'open') return res.status(400).json({ error: 'This job is no longer accepting applications' });

    const [result] = await pool.query(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [job_id, req.user.id, 'applied']
    );

    res.status(201).json({ id: result.insertId, job_id, candidate_id: req.user.id, status: 'applied' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already applied to this job' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Employer views applications for a specific job they own
router.get('/job/:jobId', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { jobId } = req.params;

    const [jobRows] = await pool.query(
      `SELECT jobs.*, companies.owner_user_id 
       FROM jobs JOIN companies ON jobs.company_id = companies.id 
       WHERE jobs.id = ?`,
      [jobId]
    );
    const job = jobRows[0];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this job posting' });
    }

    const [applications] = await pool.query(
      `SELECT applications.*, users.name, users.email 
       FROM applications JOIN users ON applications.candidate_id = users.id 
       WHERE applications.job_id = ?`,
      [jobId]
    );

    res.json({ job_id: jobId, applications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Employer updates an application's status
router.patch('/:id/status', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['applied', 'interview', 'offer', 'hired', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const [rows] = await pool.query(
      `SELECT applications.*, companies.owner_user_id 
       FROM applications 
       JOIN jobs ON applications.job_id = jobs.id 
       JOIN companies ON jobs.company_id = companies.id 
       WHERE applications.id = ?`,
      [id]
    );
    const application = rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this job posting' });
    }

    await pool.query('UPDATE applications SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Application status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;