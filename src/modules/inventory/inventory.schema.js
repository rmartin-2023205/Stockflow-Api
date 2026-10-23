import { z } from 'zod';

export const createMovementSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es obligatorio'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT'], {
    errorMap: () => ({ message: 'Tipo de movimiento inválido (IN, OUT o ADJUSTMENT)' }),
  }),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un entero positivo').optional(),
  newStock: z.coerce.number().int().min(0, 'El nuevo stock no puede ser negativo').optional(),
  reason: z.string().trim().min(3, 'El motivo es obligatorio (mínimo 3 caracteres)'),
  reference: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.type === 'ADJUSTMENT') {
      return data.newStock !== undefined || data.quantity !== undefined;
    }
    return data.quantity !== undefined && data.quantity > 0;
  },
  {
    message: 'Debes especificar una cantidad válida o un stock objetivo para el ajuste',
    path: ['quantity'],
  }
);

export const queryMovementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().trim().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'SALE', 'SALE_REVERSAL']).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});
