import { prisma } from '../../config/prisma.js';

export async function getCategories(organizationId) {
  return prisma.category.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createCategory({ organizationId, name, description }) {
  const normalizedName = name.trim();

  // Check unique name in organization
  const existing = await prisma.category.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name: normalizedName,
      },
    },
  });

  if (existing) {
    const error = new Error('Ya existe una categoría con este nombre en tu organización.');
    error.statusCode = 409;
    error.code = 'CATEGORY_ALREADY_EXISTS';
    throw error;
  }

  return prisma.category.create({
    data: {
      organizationId,
      name: normalizedName,
      description: description?.trim() || null,
    },
  });
}

export async function updateCategory({ organizationId, categoryId, name, description }) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
  });

  if (!category) {
    const error = new Error('Categoría no encontrada.');
    error.statusCode = 404;
    error.code = 'CATEGORY_NOT_FOUND';
    throw error;
  }

  const updateData = {};
  if (name !== undefined) {
    updateData.name = name.trim();
  }
  if (description !== undefined) {
    updateData.description = description ? description.trim() : null;
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: updateData,
  });
}

export async function deleteCategory({ organizationId, categoryId }) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) {
    const error = new Error('Categoría no encontrada.');
    error.statusCode = 404;
    error.code = 'CATEGORY_NOT_FOUND';
    throw error;
  }

  // Safe deletion: unassign products from category if any exist, then delete
  await prisma.$transaction([
    prisma.product.updateMany({
      where: { categoryId, organizationId },
      data: { categoryId: null },
    }),
    prisma.category.delete({
      where: { id: categoryId },
    }),
  ]);

  return { message: 'Categoría eliminada correctamente.' };
}
