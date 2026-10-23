import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../config/prisma.js';

describe('Products & Categories Module Tests', () => {
  let ownerCookie = '';
  let cashierCookie = '';
  let ownerUserId = '';
  let orgId = '';
  let createdCategoryId = '';
  let createdProductId = '';

  before(async () => {
    // 1. Register Owner and Org
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dueño Ferretería',
        email: `owner.products.${Date.now()}@stockflow.dev`,
        password: 'Password123!',
        organizationName: 'Ferretería El Martillo',
        currency: 'GTQ',
      });

    ownerCookie = ownerRes.headers['set-cookie'].find((c) => c.startsWith('stockflow_token='));
    ownerUserId = ownerRes.body.data.user.id;
    orgId = ownerRes.body.data.user.memberships[0].organization.id;

    // 2. Create a Cashier for role tests
    const cashierUser = await prisma.user.create({
      data: {
        name: 'Cajero Empleado',
        email: `cashier.products.${Date.now()}@stockflow.dev`,
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

    // Login cashier by signing token or helper
    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../../config/env.js');
    const cashierToken = jwt.sign({ userId: cashierUser.id }, env.SESSION_SECRET);
    cashierCookie = `stockflow_token=${cashierToken};`;
  });

  after(async () => {
    // Clean up
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (ownerUserId) {
      await prisma.user.deleteMany({ where: { id: ownerUserId } });
    }
  });

  // --- CATEGORIES ---
  test('POST /api/categories should create a new category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Herramientas Eléctricas',
        description: 'Taladros, pulidoras y sierras',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'Herramientas Eléctricas');
    createdCategoryId = res.body.data.id;
  });

  test('POST /api/categories should reject duplicate category name with 409', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Herramientas Eléctricas',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CATEGORY_ALREADY_EXISTS');
  });

  test('GET /api/categories should list categories for organization', async () => {
    const res = await request(app)
      .get('/api/categories')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((c) => c.id === createdCategoryId));
  });

  // --- PRODUCTS ---
  test('POST /api/products should create product and record initial stock movement', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Taladro Percutor 750W',
        sku: 'TAL-750',
        description: 'Taladro industrial reversible',
        categoryId: createdCategoryId,
        costPrice: 350.0,
        salePrice: 499.5,
        stockQuantity: 15,
        minStock: 3,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.sku, 'TAL-750');
    assert.equal(res.body.data.stockQuantity, 15);
    createdProductId = res.body.data.id;

    // Verify initial stock movement in DB
    const movement = await prisma.stockMovement.findFirst({
      where: {
        productId: createdProductId,
        organizationId: orgId,
      },
    });

    assert.ok(movement, 'Stock movement must be recorded');
    assert.equal(movement.type, 'IN');
    assert.equal(movement.quantity, 15);
    assert.equal(movement.stockAfter, 15);
  });

  test('POST /api/products should reject duplicate SKU with 409', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Otro Taladro',
        sku: 'tal-750', // tests normalization
        costPrice: 200,
        salePrice: 300,
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'SKU_ALREADY_EXISTS');
  });

  test('POST /api/products should reject negative price with 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', ownerCookie)
      .send({
        name: 'Sierra Circular',
        sku: 'SIE-100',
        costPrice: -50,
        salePrice: 100,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('GET /api/products should list and search products', async () => {
    const res = await request(app)
      .get('/api/products?search=Taladro&limit=10')
      .set('Cookie', ownerCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.products);
    assert.ok(res.body.data.meta);
    assert.equal(res.body.data.products.length, 1);
    assert.equal(res.body.data.products[0].sku, 'TAL-750');
  });

  test('PATCH /api/products/:id should update product details', async () => {
    const res = await request(app)
      .patch(`/api/products/${createdProductId}`)
      .set('Cookie', ownerCookie)
      .send({
        salePrice: 520.0,
        minStock: 5,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(Number(res.body.data.salePrice), 520.0);
    assert.equal(res.body.data.minStock, 5);
  });

  test('PATCH /api/products/:id/status should toggle active state', async () => {
    const res = await request(app)
      .patch(`/api/products/${createdProductId}/status`)
      .set('Cookie', ownerCookie)
      .send({ isActive: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.isActive, false);

    // Filter by active should no longer show it
    const listRes = await request(app)
      .get('/api/products?status=active')
      .set('Cookie', ownerCookie);

    assert.equal(listRes.body.data.products.length, 0);
  });

  // --- PERMISSIONS ---
  test('CASHIER role cannot create products (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cashierCookie)
      .send({
        name: 'Martillo de Uña',
        sku: 'MAR-01',
        costPrice: 20,
        salePrice: 35,
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN_ROLE');
  });

  test('CASHIER role can view products list (200 OK)', async () => {
    const res = await request(app)
      .get('/api/products?status=all')
      .set('Cookie', cashierCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
