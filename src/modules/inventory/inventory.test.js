import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Inventory Module Tests', () => {
  let ownerCookie = '';
  let cashierCookie = '';
  let ownerUserId = '';
  let orgId = '';
  let testProductId = '';

  before(async () => {
    // 1. Register Owner and Org
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dueño Inventario',
        email: `owner.inv.${Date.now()}@stockflow.dev`,
        password: 'Password123!',
        organizationName: 'Abarrotería San José',
        currency: 'GTQ',
      });

    ownerCookie = ownerRes.headers['set-cookie'].find((c) => c.startsWith('stockflow_token='));
    ownerUserId = ownerRes.body.data.user.id;
    orgId = ownerRes.body.data.user.memberships[0].organization.id;

    // 2. Create Cashier
    const cashierUser = await prisma.user.create({
      data: {
        name: 'Cajero Inventario',
        email: `cashier.inv.${Date.now()}@stockflow.dev`,
        passwordHash: 'fakehash',
      },
    });

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

    // 3. Create a test product with initial stock 10
    const prodRes = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Arroz Precocido 1lb',
        sku: `ARR-${Date.now()}`,
        costPrice: 5.0,
        salePrice: 8.5,
        stockQuantity: 10,
        minStock: 5,
      });

    testProductId = prodRes.body.data.id;
  });

  after(async () => {
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (ownerUserId) {
      await prisma.user.deleteMany({ where: { id: ownerUserId } });
    }
  });

  test('GET /api/inventory/summary should return initial metrics', async () => {
    const res = await request(app)
      .get('/api/inventory/summary')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.totalProducts, 1);
    assert.equal(res.body.data.totalUnits, 10);
    assert.equal(res.body.data.totalCostValue, 50.0);
    assert.equal(res.body.data.totalSaleValue, 85.0);
  });

  test('POST /api/inventory/movements (IN) should add stock atomically', async () => {
    const res = await request(app)
      .post('/api/inventory/movements')
      .set('Cookie', ownerCookie)
      .send({
        productId: testProductId,
        type: 'IN',
        quantity: 15,
        reason: 'Compra a distribuidor mayorista',
        reference: 'FAC-10029',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.movement.type, 'IN');
    assert.equal(res.body.data.movement.stockBefore, 10);
    assert.equal(res.body.data.movement.stockAfter, 25);
    assert.equal(res.body.data.product.stockQuantity, 25);
  });

  test('POST /api/inventory/movements (OUT) should decrease stock when sufficient', async () => {
    const res = await request(app)
      .post('/api/inventory/movements')
      .set('Cookie', ownerCookie)
      .send({
        productId: testProductId,
        type: 'OUT',
        quantity: 5,
        reason: 'Devolución de lote dañado',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.movement.stockBefore, 25);
    assert.equal(res.body.data.movement.stockAfter, 20);
    assert.equal(res.body.data.product.stockQuantity, 20);
  });

  test('POST /api/inventory/movements (OUT) should reject when stock would go negative', async () => {
    const res = await request(app)
      .post('/api/inventory/movements')
      .set('Cookie', ownerCookie)
      .send({
        productId: testProductId,
        type: 'OUT',
        quantity: 100, // available is only 20
        reason: 'Intento de salida excesiva',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  });

  test('POST /api/inventory/movements (ADJUSTMENT) should adjust to target stock', async () => {
    const res = await request(app)
      .post('/api/inventory/movements')
      .set('Cookie', ownerCookie)
      .send({
        productId: testProductId,
        type: 'ADJUSTMENT',
        newStock: 3, // Below minStock (5)
        reason: 'Conteo físico fin de mes: merma por empaque roto',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.movement.type, 'ADJUSTMENT');
    assert.equal(res.body.data.movement.stockBefore, 20);
    assert.equal(res.body.data.movement.stockAfter, 3);
    assert.equal(res.body.data.product.stockQuantity, 3);
  });

  test('GET /api/inventory/low-stock should now include our adjusted product', async () => {
    const res = await request(app)
      .get('/api/inventory/low-stock')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((p) => p.id === testProductId);
    assert.ok(found);
    assert.equal(found.stockQuantity, 3);
  });

  test('GET /api/inventory/movements should list all recorded transactions', async () => {
    const res = await request(app)
      .get('/api/inventory/movements')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.movements.length >= 4); // initial IN, manual IN, OUT, ADJUSTMENT
    assert.ok(res.body.data.movements[0].product.name);
    assert.ok(res.body.data.movements[0].user.name);
  });

  test('CASHIER role cannot create manual stock movements (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/inventory/movements')
      .set('Cookie', cashierCookie)
      .send({
        productId: testProductId,
        type: 'IN',
        quantity: 10,
        reason: 'Intento no autorizado',
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});
