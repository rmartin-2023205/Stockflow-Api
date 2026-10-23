import { prisma } from '../../config/prisma.js';

export async function getDashboardSummary(organizationId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    todaySales,
    totalProducts,
    allActiveProducts,
    recentSales,
    recentMovements,
  ] = await Promise.all([
    // 1. Today's completed sales
    prisma.sale.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart },
      },
      select: {
        total: true,
      },
    }),

    // 2. Total active products count
    prisma.product.count({
      where: { organizationId, isActive: true },
    }),

    // 3. Products for stock levels and valuation
    prisma.product.findMany({
      where: { organizationId, isActive: true },
      select: {
        stockQuantity: true,
        minStock: true,
        costPrice: true,
      },
    }),

    // 4. Recent sales
    prisma.sale.findMany({
      where: { organizationId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: {
          select: { name: true },
        },
      },
    }),

    // 5. Recent stock movements
    prisma.stockMovement.findMany({
      where: { organizationId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: { name: true, sku: true },
        },
        user: {
          select: { name: true },
        },
      },
    }),
  ]);

  // Aggregate today's sales
  const todaySalesTotal = todaySales.reduce(
    (acc, s) => acc + (parseFloat(s.total) || 0),
    0
  );
  const todaySalesCount = todaySales.length;

  // Aggregate stock alerts and total valuation
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalInventoryCost = 0;

  for (const p of allActiveProducts) {
    const qty = p.stockQuantity;
    const cost = parseFloat(p.costPrice) || 0;
    totalInventoryCost += qty * cost;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= p.minStock) {
      lowStockCount++;
    }
  }

  return {
    todaySales: {
      total: Math.round(todaySalesTotal * 100) / 100,
      count: todaySalesCount,
    },
    inventory: {
      totalProducts,
      totalCostValue: Math.round(totalInventoryCost * 100) / 100,
      lowStockCount,
      outOfStockCount,
    },
    recentSales: recentSales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      total: parseFloat(s.total),
      paymentMethod: s.paymentMethod,
      status: s.status,
      cashierName: s.cashier?.name,
      createdAt: s.createdAt,
    })),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      stockAfter: m.stockAfter,
      productName: m.product.name,
      sku: m.product.sku,
      userName: m.user?.name,
      reason: m.reason,
      createdAt: m.createdAt,
    })),
  };
}
