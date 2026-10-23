import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Auth Module Tests', () => {
  const testEmail = `test.owner.${Date.now()}@stockflow.dev`;
  const testPassword = 'Password123!';
  let authCookie = '';
  let createdUserId = '';
  let createdOrgId = '';

  after(async () => {
    // Clean up created test entities
    if (createdOrgId) {
      await prisma.organization.deleteMany({
        where: { id: createdOrgId },
      });
    }
    if (createdUserId) {
      await prisma.user.deleteMany({
        where: { id: createdUserId },
      });
    }
  });

  test('POST /api/auth/register should create owner and organization', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Carlos Dueño',
        email: testEmail,
        password: testPassword,
        organizationName: 'Ferretería El Cóndor',
        currency: 'GTQ',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.user);
    assert.equal(res.body.data.user.email, testEmail);
    assert.equal(res.body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.ok(res.body.data.token);
    assert.equal(res.body.data.user.memberships[0].role, 'OWNER');

    createdUserId = res.body.data.user.id;
    createdOrgId = res.body.data.user.memberships[0].organization.id;

    // Verify set-cookie header contains stockflow_token
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Auth cookie should be set');
    assert.ok(cookies.some((c) => c.includes('stockflow_token')));
  });

  test('POST /api/auth/register should reject duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Otro Nombre',
        email: testEmail,
        password: testPassword,
        organizationName: 'Otra Empresa',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  test('POST /api/auth/register should validate schema and reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'A',
        email: 'invalid-email',
        password: '123',
        organizationName: '',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /api/auth/login should fail with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'wrong-password',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('POST /api/auth/login should succeed and return user with token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.user);
    assert.equal(res.body.data.user.email, testEmail);
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(res.body.data.token);

    // Capture cookie for subsequent tests
    const rawCookies = res.headers['set-cookie'];
    authCookie = rawCookies.find((c) => c.startsWith('stockflow_token='));
    assert.ok(authCookie);
  });

  test('GET /api/auth/me should fail with 401 when not authenticated', async () => {
    const res = await request(app).get('/api/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/auth/me should return current user when cookie is present', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, testEmail);
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(res.body.data.activeMembership);
    assert.equal(res.body.data.activeMembership.role, 'OWNER');
  });

  test('POST /api/auth/logout should clear cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    assert.ok(cookies.some((c) => c.includes('stockflow_token=;')));
  });
});
