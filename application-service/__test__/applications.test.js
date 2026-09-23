const request = require('supertest');
const app = require('../app');
const pool = require('../db');
const redisClientCheck = null; // application-service doesn't use Redis, skip this
const jwt = require('jsonwebtoken');
const { connectQueue, closeQueue } = require('../queue');

const candidateToken = jwt.sign({ id: 1, role: 'candidate' }, process.env.JWT_SECRET, { expiresIn: '15m' });
const employerToken = jwt.sign({ id: 2, role: 'employer' }, process.env.JWT_SECRET, { expiresIn: '15m' });

let testJobId;
let createdApplicationId;

describe('Application Service', () => {
  beforeAll(async () => {
    await connectQueue(); // queue.js needs an active channel before publishApplicationCreated can be called

    // Create a throwaway job directly in the DB so this test doesn't depend on Job Service being up
    const [result] = await pool.query(
      'INSERT INTO jobs (company_id, title, description, status) VALUES (?, ?, ?, ?)',
      [1, 'Test Job For Applications', 'temp', 'open']
    );
    testJobId = result.insertId;
  });

  afterAll(async () => {
    if (createdApplicationId) {
        await pool.query('DELETE FROM applications WHERE id = ?', [createdApplicationId]);
    }
    if (testJobId) {
        await pool.query('DELETE FROM jobs WHERE id = ?', [testJobId]);
    }
    await pool.end();
    await closeQueue();
  });

  test('candidate can apply to an open job', async () => {
    const res = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ job_id: testJobId });

    expect(res.statusCode).toBe(201);
    createdApplicationId = res.body.id;
  });

  test('candidate cannot apply to the same job twice', async () => {
    const res = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ job_id: testJobId });

    expect(res.statusCode).toBe(409);
  });

  test('employer cannot apply to a job', async () => {
    const res = await request(app)
      .post('/applications')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ job_id: testJobId });

    expect(res.statusCode).toBe(403);
  });

  test('employer can view applicants for their job', async () => {
    const res = await request(app)
      .get(`/applications/job/${testJobId}`)
      .set('Authorization', `Bearer ${employerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.applications.length).toBeGreaterThan(0);
  });

  test('employer can update an application status', async () => {
    const res = await request(app)
      .patch(`/applications/${createdApplicationId}/status`)
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ status: 'interview' });

    expect(res.statusCode).toBe(200);
  });
});