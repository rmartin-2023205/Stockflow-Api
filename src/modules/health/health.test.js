import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';

describe('Health Check API', () => {
  test('GET /api/health should return 200 and system status', async () => {
    const res = await request(app).get('/api/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data);
    assert.equal(res.body.data.status, 'ok');
    assert.ok(res.body.data.timestamp);
    assert.ok(['connected', 'disconnected', 'error'].includes(res.body.data.database));
  });

  test('GET /api/nonexistent should return 404 with structured error', async () => {
    const res = await request(app).get('/api/nonexistent');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
  });
});
