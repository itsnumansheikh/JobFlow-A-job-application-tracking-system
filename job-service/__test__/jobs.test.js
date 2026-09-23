const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const redisClient = require('../redisClient');

// Build fake tokens directly instead of hitting Auth Service over HTTP —
// this keeps Job Service's tests independent of Auth Service being up
const employerToken = jwt.sign({ id: 2, role: 'employer' }, process.env.JWT_SECRET, { expiresIn: '15m' });
const candidateToken = jwt.sign({ id: 1, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '15m' });

let createdJobId;

describe('Job Service', () => {
  afterAll(async () => {
  if (createdJobId) {
    await pool.query('DELETE FROM jobs WHERE id = ?', [createdJobId]);
  }
  await pool.end();
  await redisClient.quit(); // closes the Redis connection so Jest can exit cleanly
});

  test('employer can create a job', async () => {
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ company_id: 1, title: 'Test Job', description: 'A job for testing' });

    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe('Test Job');
    createdJobId = res.body.id;
  });

  test('candidate cannot create a job', async () => {
    const res = await request(app)
      .post('/jobs')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ company_id: 1, title: 'Should Fail', description: 'Not allowed' });

    expect(res.statusCode).toBe(403);
  });

  test('creating a job with no auth token fails', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ company_id: 1, title: 'No Auth', description: 'Should fail' });

    expect(res.statusCode).toBe(401);
  });

  test('anyone can list jobs', async () => {
    const res = await request(app).get('/jobs');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test('employer can edit their own job', async () => {
    const res = await request(app)
      .patch(`/jobs/${createdJobId}`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'closed' });

    expect(res.statusCode).toBe(200);
  });

  test('employer can delete their own job', async () => {
    const res = await request(app)
      .delete(`/jobs/${createdJobId}`)
      .set('Authorization', `Bearer ${employerToken}`);

    expect(res.statusCode).toBe(200);
    createdJobId = null; // already deleted, don't try again in afterAll
  });
});