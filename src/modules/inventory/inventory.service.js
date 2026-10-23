import { prisma } from '../../config/prisma.js';

/**
 * Register an atomic stock movement (IN, OUT, ADJUSTMENT)
 */
export async function createStockMovement({
  organizationId,
  userId,
  productId,
  type,
  quantity,
  newStock,
  reason,
  reference,
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch product verifying organization
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
    });

    if (!product) {
      const error = new Error('Producto no encontrado en esta organización.');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    const stockBefore = product.stockQuantity;
    let stockAfter = stockBefore;
    let actualQuantity = quantity || 0;

    // 2. Calculate balance according to movement type
    if (type === 'IN') {
      stockAfter = stockBefore + actualQuantity;
    } else if (type === 'OUT') {
      if (stockBefore < actualQuantity) {
        const error = new Error(
          `Stock insuficiente para realizar la salida. Existencias actuales: ${stockBefore}, Solicitado: ${actualQuantity}.`
        );
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_STOCK';
        throw error;
      }
      stockAfter = stockBefore - actualQuantity;
    } else if (type === 'ADJUSTMENT') {
      if (newStock !== undefined) {
        stockAfter = newStock;
        actualQuantity = Math.abs(newStock - stockBefore);
      } else {
        stockAfter = stockBefore + actualQuantity;
        if (stockAfter < 0) {
          const error = new Error(
            `El ajuste no puede dejar el stock en negativo. Existencias actuales: ${stockBefore}.`
          );
          error.statusCode = 400;
          error.code = 'INSUFFICIENT_STOCK';
          throw error;
        }
        actualQuantity = Math.abs(actualQuantity);
      }
    }

    // 3. Update product balance
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: stockAfter,
      },
    });

    // 4. Create immutable movement ledger record
    const movement = await tx.stockMovement.create({
      data: {
        organizationId,
        productId,
        userId,
        type,
        quantity: actualQuantity,
        stockBefore,
        stockAfter,
        reason: reference ? `${reason.trim()} (Ref: ${reference.trim()})` : reason.trim(),
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      movement,
      product: updatedProduct,
    };
  });
}

/**
 * Retrieve paginated immutable stock movements history
 */
export async function getStockMovements({
  organizationId,
  page = 1,
  limit = 20,
  productId,
  type,
  startDate,
  endDate,
}) {
  const where = {
    organizationId,
  };

  if (productId) {
    where.productId = productId;
  }

  if (type) {
    where.type = type;
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

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    movements,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Get consolidated inventory metrics and summary
 */
export async function getInventorySummary(organizationId) {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      stockQuantity: true,
      minStock: true,
      costPrice: true,
      salePrice: true,
    },
  });

  let totalUnits = 0;
  let totalCostValue = 0;
  let totalSaleValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    const qty = p.stockQuantity;
    const cost = parseFloat(p.costPrice) || 0;
    const sale = parseFloat(p.salePrice) || 0;

    totalUnits += qty;
    totalCostValue += qty * cost;
    totalSaleValue += qty * sale;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= p.minStock) {
      lowStockCount++;
    }
  }

  return {
    totalProducts: products.length,
    totalUnits,
    totalCostValue: Math.round(totalCostValue * 100) / 100,
    totalSaleValue: Math.round(totalSaleValue * 100) / 100,
    lowStockCount,
    outOfStockCount,
  };
}

/**
 * Get products that are at or below minimum stock threshold
 */
export async function getLowStockProducts(organizationId) {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      stockQuantity: 'asc',
    },
  });

  // Filter in memory for stockQuantity <= minStock
  return products.filter((p) => p.stockQuantity <= p.minStock);
}
