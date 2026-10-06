const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const redisClient = require('../redisClient');

// Build fake tokens directly instead of hitting Auth Service over HTTP —
// this keeps Job Service's tests independent of Auth Service being up
const candidateToken = jwt.sign({ id: 1, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '15m' });

let createdJobId;
let testCompanyId;
let testEmployerId;
let employerToken;

describe('Job Service', () => {
  beforeAll(async () => {
    const [userResult] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Test Employer', `test-employer-${Date.now()}@test.com`, 'dummy_hash', 'employer']
    );
    testEmployerId = userResult.insertId;
    employerToken = jwt.sign({ id: testEmployerId, role: 'employer' }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const [companyResult] = await pool.query(
      'INSERT INTO companies (name, description, owner_user_id) VALUES (?, ?, ?)',
      ['Test Company For Jobs', 'temp', testEmployerId]
    );
    testCompanyId = companyResult.insertId;
  });

  afterAll(async () => {
    if (createdJobId) {
      await pool.query('DELETE FROM jobs WHERE id = ?', [createdJobId]);
    }
    if (testCompanyId) {
      await pool.query('DELETE FROM companies WHERE id = ?', [testCompanyId]);
    }
    if (testEmployerId) {
      await pool.query('DELETE FROM users WHERE id = ?', [testEmployerId]);
    }
    await pool.end();
    await redisClient.quit();
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