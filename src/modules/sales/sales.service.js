import { prisma } from '../../config/prisma.js';

/**
 * Execute an atomic point-of-sale transaction
 */
export async function createSale({
  organizationId,
  cashierId,
  items,
  paymentMethod = 'CASH',
  discountTotal = 0,
  amountReceived,
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch all requested products and verify tenant
    const productIds = items.map((i) => i.productId);
    const dbProducts = await tx.product.findMany({
      where: {
        id: { in: productIds },
        organizationId,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedSubtotal = 0;
    const saleItemsData = [];
    const stockUpdates = [];

    // 2. Validate stock and build immutable snapshots
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        const error = new Error(`El producto con ID ${item.productId} no existe o no pertenece a tu negocio.`);
        error.statusCode = 404;
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
      }

      if (!product.isActive) {
        const error = new Error(`El producto "${product.name}" (${product.sku}) está inactivo.`);
        error.statusCode = 400;
        error.code = 'PRODUCT_INACTIVE';
        throw error;
      }

      if (product.stockQuantity < item.quantity) {
        const error = new Error(
          `Stock insuficiente para "${product.name}" (${product.sku}). Solicitado: ${item.quantity}, Disponible: ${product.stockQuantity}.`
        );
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      const unitPrice = parseFloat(product.salePrice);
      const unitCost = parseFloat(product.costPrice);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      calculatedSubtotal += lineTotal;

      saleItemsData.push({
        productId: product.id,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        quantity: item.quantity,
        unitPrice,
        unitCostSnapshot: unitCost,
        lineTotal,
      });

      stockUpdates.push({
        productId: product.id,
        quantity: item.quantity,
        stockBefore: product.stockQuantity,
        stockAfter: product.stockQuantity - item.quantity,
      });
    }

    calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
    const sanitizedDiscount = Math.min(calculatedSubtotal, Math.max(0, discountTotal));
    const calculatedTotal = Math.round((calculatedSubtotal - sanitizedDiscount) * 100) / 100;

    // Validate cash payment change
    let changeAmount = 0;
    if (paymentMethod === 'CASH' && amountReceived !== undefined) {
      if (amountReceived < calculatedTotal) {
        const error = new Error(
          `El monto recibido (${amountReceived}) es menor al total a cobrar (${calculatedTotal}).`
        );
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_PAYMENT';
        throw error;
      }
      changeAmount = Math.round((amountReceived - calculatedTotal) * 100) / 100;
    }

    // 3. Generate sequential sale number
    const totalSalesCount = await tx.sale.count({
      where: { organizationId },
    });
    const saleNumber = `VTA-${String(totalSalesCount + 1).padStart(5, '0')}`;

    // 4. Create Sale and SaleItems atomically
    const sale = await tx.sale.create({
      data: {
        organizationId,
        cashierId,
        saleNumber,
        subtotal: calculatedSubtotal,
        discountTotal: sanitizedDiscount,
        total: calculatedTotal,
        paymentMethod,
        status: 'COMPLETED',
        items: {
          create: saleItemsData,
        },
      },
      include: {
        items: true,
        cashier: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 5. Decrement stock and record audit StockMovements
    for (const update of stockUpdates) {
      await tx.product.update({
        where: { id: update.productId },
        data: {
          stockQuantity: update.stockAfter,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: update.productId,
          userId: cashierId,
          type: 'SALE',
          quantity: update.quantity,
          stockBefore: update.stockBefore,
          stockAfter: update.stockAfter,
          reason: `Venta en POS #${saleNumber}`,
          saleId: sale.id,
        },
      });
    }

    return {
      ...sale,
      amountReceived: amountReceived ?? null,
      changeAmount,
    };
  });
}

/**
 * Retrieve paginated sales history
 */
export async function getSales({
  organizationId,
  page = 1,
  limit = 20,
  status = 'all',
  cashierId,
  startDate,
  endDate,
}) {
  const where = {
    organizationId,
  };

  if (status === 'COMPLETED' || status === 'CANCELLED') {
    where.status = status;
  }

  if (cashierId) {
    where.cashierId = cashierId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (page - 1) * limit;

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    }),
  ]);

  return {
    sales,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieve full sale detail by ID
 */
export async function getSaleById({ organizationId, saleId }) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      organizationId,
    },
    include: {
      items: true,
      cashier: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      cancelledBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!sale) {
    const error = new Error('Venta no encontrada.');
    error.statusCode = 404;
    error.code = 'SALE_NOT_FOUND';
    throw error;
  }

  return sale;
}

/**
 * Cancel a sale and reverse stock quantities atomically (OWNER only)
 */
export async function cancelSale({
  organizationId,
  userId,
  saleId,
  reason,
}) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      const error = new Error('Venta no encontrada.');
      error.statusCode = 404;
      error.code = 'SALE_NOT_FOUND';
      throw error;
    }

    if (sale.status === 'CANCELLED') {
      const error = new Error('Esta venta ya ha sido anulada previamente.');
      error.statusCode = 400;
      error.code = 'SALE_ALREADY_CANCELLED';
      throw error;
    }

    // 1. Update sale record to CANCELLED
    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: {
        status: 'CANCELLED',
        cancelledById: userId,
        cancelledAt: new Date(),
        cancellationReason: reason.trim(),
      },
      include: {
        items: true,
        cashier: {
          select: { id: true, name: true },
        },
        cancelledBy: {
          select: { id: true, name: true },
        },
      },
    });

    // 2. Re-increment product stock and log SALE_REVERSAL movements
    for (const item of sale.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });

      if (product) {
        const stockBefore = product.stockQuantity;
        const stockAfter = stockBefore + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: stockAfter,
          },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: item.productId,
            userId,
            type: 'SALE_REVERSAL',
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            reason: `Anulación de venta #${sale.saleNumber}: ${reason.trim()}`,
            saleId: sale.id,
          },
        });
      }
    }

    return updatedSale;
  });
}
