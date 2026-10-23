import { prisma } from '../../config/prisma.js';

export async function getProducts({
  organizationId,
  page = 1,
  limit = 20,
  search,
  categoryId,
  status = 'active',
  sortBy = 'createdAt',
  sortOrder = 'desc',
}) {
  const where = {
    organizationId,
  };

  // Status filter
  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  // Category filter
  if (categoryId) {
    where.categoryId = categoryId;
  }

  // Search filter (name or SKU)
  if (search && search.trim() !== '') {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;

  // Execute query and count concurrently
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    products,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getProductById({ organizationId, productId }) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
    },
    include: {
      category: true,
    },
  });

  if (!product) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  return product;
}

export async function createProduct({
  organizationId,
  userId,
  name,
  sku,
  description,
  categoryId,
  costPrice,
  salePrice,
  stockQuantity = 0,
  minStock = 5,
}) {
  const normalizedSku = sku.trim().toUpperCase();

  // 1. Verify SKU uniqueness in organization
  const existingSku = await prisma.product.findUnique({
    where: {
      organizationId_sku: {
        organizationId,
        sku: normalizedSku,
      },
    },
  });

  if (existingSku) {
    const error = new Error(`El código SKU "${normalizedSku}" ya está registrado en tu organización.`);
    error.statusCode = 409;
    error.code = 'SKU_ALREADY_EXISTS';
    throw error;
  }

  // 2. Verify category belongs to organization if provided
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!category) {
      const error = new Error('La categoría seleccionada no existe en esta organización.');
      error.statusCode = 400;
      error.code = 'INVALID_CATEGORY';
      throw error;
    }
  }

  // 3. Atomically create product and initial stock movement (if initial stock > 0)
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        organizationId,
        name: name.trim(),
        sku: normalizedSku,
        description: description?.trim() || null,
        categoryId: categoryId || null,
        costPrice,
        salePrice,
        stockQuantity,
        minStock,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    if (stockQuantity > 0 && userId) {
      await tx.stockMovement.create({
        data: {
          organizationId,
          productId: product.id,
          userId,
          type: 'IN',
          quantity: stockQuantity,
          stockBefore: 0,
          stockAfter: stockQuantity,
          reason: 'Inventario inicial al dar de alta el producto',
        },
      });
    }

    return product;
  });
}

export async function updateProduct({
  organizationId,
  productId,
  name,
  description,
  categoryId,
  costPrice,
  salePrice,
  minStock,
  isActive,
}) {
  // Check if product exists in organization
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
  });

  if (!product) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  // If category changed, verify ownership
  if (categoryId !== undefined && categoryId !== null) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, organizationId },
    });
    if (!category) {
      const error = new Error('La categoría seleccionada no existe en esta organización.');
      error.statusCode = 400;
      error.code = 'INVALID_CATEGORY';
      throw error;
    }
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description ? description.trim() : null;
  if (categoryId !== undefined) updateData.categoryId = categoryId;
  if (costPrice !== undefined) updateData.costPrice = costPrice;
  if (salePrice !== undefined) updateData.salePrice = salePrice;
  if (minStock !== undefined) updateData.minStock = minStock;
  if (isActive !== undefined) updateData.isActive = isActive;

  return prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: {
      category: true,
    },
  });
}

export async function toggleProductStatus({ organizationId, productId, isActive }) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
  });

  if (!product) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  const newStatus = typeof isActive === 'boolean' ? isActive : !product.isActive;

  return prisma.product.update({
    where: { id: productId },
    data: { isActive: newStatus },
    include: {
      category: true,
    },
  });
}
