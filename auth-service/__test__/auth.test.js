const request = require('supertest');
const app = require('../app');
const pool = require('../db');

// Use a throwaway email so re-running tests doesn't collide with real data
const testEmail = `testuser_${Date.now()}@test.com`;

describe('Auth Service', () => {
  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
    await pool.end(); // closes the DB connection pool so Jest can exit cleanly
  });

  test('signup creates a new user', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: testEmail,
      password: 'testpass123',
      role: 'candidate',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe(testEmail);
  });

  test('signup rejects duplicate email', async () => {
    const res = await request(app).post('/auth/signup').send({
      name: 'Test User',
      email: testEmail,
      password: 'testpass123',
      role: 'candidate',
    });

    expect(res.statusCode).toBe(409);
  });

  test('login succeeds with correct credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: testEmail,
      password: 'testpass123',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('login fails with wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: testEmail,
      password: 'wrongpassword',
    });

    expect(res.statusCode).toBe(401);
  });

  test('/auth/me rejects request with no token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.statusCode).toBe(401);
  });

  test('/auth/me accepts request with valid token', async () => {
    const loginRes = await request(app).post('/auth/login').send({
      email: testEmail,
      password: 'testpass123',
    });

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(res.statusCode).toBe(200);
  });
});