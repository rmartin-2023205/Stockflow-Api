import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Reports & Analytics Module Tests', () => {
  let ownerCookie = '';
  let cashierCookie = '';
  let ownerUserId = '';
  let cashierUserId = '';
  let orgId = '';

  before(async () => {
    // 1. Register Owner
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dueña Boutique',
        email: `owner.reports.${Date.now()}@stockflow.dev`,
        password: 'Password123!',
        organizationName: 'Boutique Elegance',
        currency: 'GTQ',
      });

    ownerCookie = ownerRes.headers['set-cookie'].find((c) => c.startsWith('stockflow_token='));
    ownerUserId = ownerRes.body.data.user.id;
    orgId = ownerRes.body.data.user.memberships[0].organization.id;

    // 2. Create Cashier
    const cashierUser = await prisma.user.create({
      data: {
        name: 'Cajera Reportes',
        email: `cashier.reports.${Date.now()}@stockflow.dev`,
        passwordHash: 'fakehash',
      },
    });
    cashierUserId = cashierUser.id;

    await prisma.membership.create({
      data: {
        userId: cashierUser.id,
        organizationId: orgId,
        role: 'CASHIER',
      },
    });

    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../../config/env.js');
    const cashierToken = jwt.sign({ userId: cashierUser.id }, env.SESSION_SECRET);
    cashierCookie = `stockflow_token=${cashierToken};`;

    // 3. Create products and execute a sale
    const p1 = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Camisa Lino Azul',
        sku: `CAM-${Date.now()}`,
        costPrice: 50.0,
        salePrice: 100.0,
        stockQuantity: 10,
        minStock: 2,
      });

    await request(app)
      .post('/api/sales')
      .set('Cookie', ownerCookie)
      .send({
        items: [{ productId: p1.body.data.id, quantity: 2 }], // 2 * 100 = 200, cost = 100, profit = 100 (50%)
        paymentMethod: 'CARD',
      });
  });

  after(async () => {
    if (orgId) {
      await prisma.saleItem.deleteMany({ where: { sale: { organizationId: orgId } } });
      await prisma.stockMovement.deleteMany({ where: { organizationId: orgId } });
      await prisma.sale.deleteMany({ where: { organizationId: orgId } });
      await prisma.product.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (ownerUserId) {
      await prisma.user.deleteMany({ where: { id: ownerUserId } });
    }
    if (cashierUserId) {
      await prisma.user.deleteMany({ where: { id: cashierUserId } });
    }
  });

  test('GET /api/reports should calculate accurate financial metrics for OWNER', async () => {
    const res = await request(app)
      .get('/api/reports?period=today')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.metrics.totalRevenue, 200.0);
    assert.equal(res.body.data.metrics.totalCostOfGoods, 100.0);
    assert.equal(res.body.data.metrics.grossProfit, 100.0);
    assert.equal(res.body.data.metrics.profitMarginPercentage, 50.0);
    assert.equal(res.body.data.metrics.totalSalesCount, 1);
    assert.equal(res.body.data.metrics.averageTicket, 200.0);
    assert.equal(res.body.data.topProducts.length, 1);
    assert.equal(res.body.data.topProducts[0].unitsSold, 2);
  });

  test('CASHIER role cannot access financial reports (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/reports')
      .set('Cookie', cashierCookie);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});
