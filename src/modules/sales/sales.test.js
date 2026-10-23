import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Sales & POS Module Tests', () => {
  let ownerCookie = '';
  let cashierCookie = '';
  let ownerUserId = '';
  let cashierUserId = '';
  let orgId = '';
  let product1Id = '';
  let product2Id = '';
  let createdSaleId = '';

  before(async () => {
    // 1. Register Owner
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dueño Supermercado',
        email: `owner.sales.${Date.now()}@stockflow.dev`,
        password: 'Password123!',
        organizationName: 'Supermercado Central',
        currency: 'GTQ',
      });

    ownerCookie = ownerRes.headers['set-cookie'].find((c) => c.startsWith('stockflow_token='));
    ownerUserId = ownerRes.body.data.user.id;
    orgId = ownerRes.body.data.user.memberships[0].organization.id;

    // 2. Create Cashier
    const cashierUser = await prisma.user.create({
      data: {
        name: 'Cajera Turno Mañana',
        email: `cashier.sales.${Date.now()}@stockflow.dev`,
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

    // 3. Create two products with stock
    const p1 = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Leche Entera 1L',
        sku: `LEC-${Date.now()}`,
        costPrice: 8.0,
        salePrice: 12.0,
        stockQuantity: 20,
        minStock: 5,
      });
    product1Id = p1.body.data.id;

    const p2 = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Cereal Maíz 500g',
        sku: `CER-${Date.now()}`,
        costPrice: 15.0,
        salePrice: 22.0,
        stockQuantity: 5,
        minStock: 2,
      });
    product2Id = p2.body.data.id;
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

  test('POST /api/sales should execute atomic sale and deduct stock', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Cookie', cashierCookie)
      .send({
        items: [
          { productId: product1Id, quantity: 2 }, // 2 * 12 = 24
          { productId: product2Id, quantity: 1 }, // 1 * 22 = 22 -> Subtotal = 46
        ],
        paymentMethod: 'CASH',
        discountTotal: 2.0, // Total = 44
        amountReceived: 50.0, // Change = 6
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(parseFloat(res.body.data.subtotal), 46.0);
    assert.equal(parseFloat(res.body.data.discountTotal), 2.0);
    assert.equal(parseFloat(res.body.data.total), 44.0);
    assert.equal(res.body.data.changeAmount, 6.0);
    assert.equal(res.body.data.saleNumber, 'VTA-00001');
    assert.equal(res.body.data.items.length, 2);

    createdSaleId = res.body.data.id;

    // Verify stock deduction in DB
    const updatedP1 = await prisma.product.findUnique({ where: { id: product1Id } });
    assert.equal(updatedP1.stockQuantity, 18); // 20 - 2

    const updatedP2 = await prisma.product.findUnique({ where: { id: product2Id } });
    assert.equal(updatedP2.stockQuantity, 4); // 5 - 1

    // Verify StockMovement audit records
    const movements = await prisma.stockMovement.findMany({
      where: { saleId: createdSaleId },
    });
    assert.equal(movements.length, 2);
    assert.equal(movements[0].type, 'SALE');
  });

  test('POST /api/sales should reject when requested quantity exceeds stock', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Cookie', cashierCookie)
      .send({
        items: [{ productId: product2Id, quantity: 50 }], // Available is only 4
        paymentMethod: 'CASH',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  });

  test('GET /api/sales should return list of sales for organization', async () => {
    const res = await request(app)
      .get('/api/sales')
      .set('Cookie', cashierCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.sales.length, 1);
    assert.equal(res.body.data.sales[0].saleNumber, 'VTA-00001');
  });

  test('GET /api/sales/:id should return complete sale detail with items and snapshots', async () => {
    const res = await request(app)
      .get(`/api/sales/${createdSaleId}`)
      .set('Cookie', cashierCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, createdSaleId);
    assert.equal(res.body.data.items.length, 2);
    assert.equal(res.body.data.items[0].productNameSnapshot, 'Leche Entera 1L');
  });

  test('CASHIER role cannot cancel a sale (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/sales/${createdSaleId}/cancel`)
      .set('Cookie', cashierCookie)
      .send({
        reason: 'Error en cobro',
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('OWNER can cancel sale and stock is restored automatically', async () => {
    const res = await request(app)
      .post(`/api/sales/${createdSaleId}/cancel`)
      .set('Cookie', ownerCookie)
      .send({
        reason: 'Cliente canceló la compra y devolvió los productos intactos',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'CANCELLED');

    // Verify stock restoration
    const restoredP1 = await prisma.product.findUnique({ where: { id: product1Id } });
    assert.equal(restoredP1.stockQuantity, 20); // 18 + 2

    const restoredP2 = await prisma.product.findUnique({ where: { id: product2Id } });
    assert.equal(restoredP2.stockQuantity, 5); // 4 + 1

    // Verify SALE_REVERSAL movements
    const reversalMovements = await prisma.stockMovement.findMany({
      where: { saleId: createdSaleId, type: 'SALE_REVERSAL' },
    });
    assert.equal(reversalMovements.length, 2);
  });

  test('Cannot cancel an already cancelled sale (400 SALE_ALREADY_CANCELLED)', async () => {
    const res = await request(app)
      .post(`/api/sales/${createdSaleId}/cancel`)
      .set('Cookie', ownerCookie)
      .send({
        reason: 'Intento de doble anulación',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'SALE_ALREADY_CANCELLED');
  });
});
