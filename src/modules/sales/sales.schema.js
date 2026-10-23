import { z } from 'zod';

export const createSaleItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es obligatorio'),
  quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
});

export const createSaleSchema = z.object({
  items: z.array(createSaleItemSchema).min(1, 'La venta debe contener al menos un producto'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).default('CASH'),
  discountTotal: z.coerce.number().min(0, 'El descuento no puede ser negativo').default(0),
  amountReceived: z.coerce.number().min(0).optional(),
});

export const cancelSaleSchema = z.object({
  reason: z.string().trim().min(3, 'El motivo de anulación es obligatorio (mínimo 3 caracteres)'),
});

export const querySalesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['COMPLETED', 'CANCELLED', 'all']).default('all'),
  cashierId: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});
