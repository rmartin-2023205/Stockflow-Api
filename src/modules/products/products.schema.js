import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  sku: z
    .string()
    .trim()
    .min(2, 'El SKU debe tener al menos 2 caracteres')
    .toUpperCase(),
  description: z.string().trim().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo'),
  salePrice: z.coerce.number().min(0, 'El precio de venta no puede ser negativo'),
  stockQuantity: z.coerce.number().int().min(0, 'El stock no puede ser negativo').default(0),
  minStock: z.coerce.number().int().min(0, 'El stock mínimo no puede ser negativo').default(5),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  description: z.string().trim().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo').optional(),
  salePrice: z.coerce.number().min(0, 'El precio de venta no puede ser negativo').optional(),
  minStock: z.coerce.number().int().min(0, 'El stock mínimo no puede ser negativo').optional(),
  isActive: z.boolean().optional(),
});

export const queryProductSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  sortBy: z.enum(['name', 'sku', 'salePrice', 'stockQuantity', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
