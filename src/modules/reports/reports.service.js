import { prisma } from '../../config/prisma.js';

export async function getFinancialReport({
  organizationId,
  period = '7days',
  startDate,
  endDate,
}) {
  const now = new Date();
  let start = new Date();

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === '7days') {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (period === '30days') {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (period === 'custom') {
    if (startDate) {
      start = new Date(startDate);
    }
    if (endDate) {
      now.setTime(new Date(endDate).getTime());
      now.setHours(23, 59, 59, 999);
    }
  }

  // Query completed sales in period
  const completedSales = await prisma.sale.findMany({
    where: {
      organizationId,
      status: 'COMPLETED',
      createdAt: {
        gte: start,
        lte: now,
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Query cancelled sales in period for loss/reversal tracking
  const cancelledSales = await prisma.sale.findMany({
    where: {
      organizationId,
      status: 'CANCELLED',
      createdAt: {
        gte: start,
        lte: now,
      },
    },
  });

  let totalRevenue = 0;
  let totalCostOfGoods = 0;
  const productAggMap = new Map();
  const paymentMethodMap = {
    CASH: { count: 0, total: 0 },
    CARD: { count: 0, total: 0 },
    TRANSFER: { count: 0, total: 0 },
    OTHER: { count: 0, total: 0 },
  };
  const dailyTrendMap = new Map();

  for (const sale of completedSales) {
    const saleTotal = parseFloat(sale.total) || 0;
    totalRevenue += saleTotal;

    // Payment methods aggregation
    const method = paymentMethodMap[sale.paymentMethod] || paymentMethodMap.OTHER;
    method.count += 1;
    method.total += saleTotal;

    // Daily trend
    const dayKey = sale.createdAt.toISOString().slice(0, 10);
    if (!dailyTrendMap.has(dayKey)) {
      dailyTrendMap.set(dayKey, { date: dayKey, count: 0, revenue: 0 });
    }
    const dayData = dailyTrendMap.get(dayKey);
    dayData.count += 1;
    dayData.revenue += saleTotal;

    // Items aggregation
    for (const item of sale.items) {
      const cost = parseFloat(item.unitCostSnapshot) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const qty = item.quantity;

      totalCostOfGoods += cost * qty;

      if (!productAggMap.has(item.productId)) {
        productAggMap.set(item.productId, {
          productId: item.productId,
          name: item.productNameSnapshot,
          sku: item.skuSnapshot,
          unitsSold: 0,
          totalRevenue: 0,
          totalCost: 0,
        });
      }
      const prod = productAggMap.get(item.productId);
      prod.unitsSold += qty;
      prod.totalRevenue += price * qty;
      prod.totalCost += cost * qty;
    }
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;
  totalCostOfGoods = Math.round(totalCostOfGoods * 100) / 100;
  const grossProfit = Math.round((totalRevenue - totalCostOfGoods) * 100) / 100;
  const profitMarginPercentage = totalRevenue > 0
    ? Math.round((grossProfit / totalRevenue) * 1000) / 10
    : 0;
  const totalSalesCount = completedSales.length;
  const averageTicket = totalSalesCount > 0
    ? Math.round((totalRevenue / totalSalesCount) * 100) / 100
    : 0;

  // Top 5 products by units sold
  const topProducts = Array.from(productAggMap.values())
    .map((p) => ({
      ...p,
      profit: Math.round((p.totalRevenue - p.totalCost) * 100) / 100,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  const cancelledRevenue = cancelledSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);

  return {
    period,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    metrics: {
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      profitMarginPercentage,
      totalSalesCount,
      averageTicket,
      cancelledSalesCount: cancelledSales.length,
      cancelledRevenue: Math.round(cancelledRevenue * 100) / 100,
    },
    topProducts,
    paymentMethods: [
      { method: 'CASH', label: 'Efectivo', ...paymentMethodMap.CASH, total: Math.round(paymentMethodMap.CASH.total * 100) / 100 },
      { method: 'CARD', label: 'Tarjeta', ...paymentMethodMap.CARD, total: Math.round(paymentMethodMap.CARD.total * 100) / 100 },
      { method: 'TRANSFER', label: 'Transferencia', ...paymentMethodMap.TRANSFER, total: Math.round(paymentMethodMap.TRANSFER.total * 100) / 100 },
    ],
    dailyTrend: Array.from(dailyTrendMap.values()).map((d) => ({
      ...d,
      revenue: Math.round(d.revenue * 100) / 100,
    })),
  };
}
