import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Organizations & Dashboard Module Tests', () => {
  let ownerCookie = '';
  let cashierCookie = '';
  let ownerUserId = '';
  let cashierUserId = '';
  let orgId = '';
  let cashierMembershipId = '';

  before(async () => {
    // 1. Register Owner and Org
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dueño Corporativo',
        email: `owner.org.${Date.now()}@stockflow.dev`,
        password: 'Password123!',
        organizationName: 'Comercializadora Global',
        currency: 'GTQ',
      });

    ownerCookie = ownerRes.headers['set-cookie'].find((c) => c.startsWith('stockflow_token='));
    ownerUserId = ownerRes.body.data.user.id;
    orgId = ownerRes.body.data.user.memberships[0].organization.id;

    // 2. Register Cashier through Organizations API
    const addRes = await request(app)
      .post('/api/organizations/members')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Cajero Contratado',
        email: `cashier.org.${Date.now()}@stockflow.dev`,
        password: 'CashierPassword123!',
        role: 'CASHIER',
      });

    cashierMembershipId = addRes.body.data.id;
    cashierUserId = addRes.body.data.user.id;

    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../../config/env.js');
    const cashierToken = jwt.sign({ userId: cashierUserId }, env.SESSION_SECRET);
    cashierCookie = `stockflow_token=${cashierToken};`;
  });

  after(async () => {
    if (orgId) {
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (ownerUserId) {
      await prisma.user.deleteMany({ where: { id: ownerUserId } });
    }
    if (cashierUserId) {
      await prisma.user.deleteMany({ where: { id: cashierUserId } });
    }
  });

  test('GET /api/organizations/members should list all staff for OWNER', async () => {
    const res = await request(app)
      .get('/api/organizations/members')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 2); // Owner + Cashier
  });

  test('CASHIER role cannot manage organization members (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/organizations/members')
      .set('Cookie', cashierCookie);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('GET /api/dashboard/summary should return consolidated real-time overview', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.todaySales);
    assert.ok(res.body.data.inventory);
    assert.ok(Array.isArray(res.body.data.recentSales));
    assert.ok(Array.isArray(res.body.data.recentMovements));
  });

  test('DELETE /api/organizations/members/:id should remove cashier', async () => {
    const res = await request(app)
      .delete(`/api/organizations/members/${cashierMembershipId}`)
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify cashier count is now 1 (only owner remains)
    const membersRes = await request(app)
      .get('/api/organizations/members')
      .set('Cookie', ownerCookie);

    assert.equal(membersRes.body.data.length, 1);
  });
});
