import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(50, 'Máximo 50 caracteres'),
  description: z.string().trim().max(255).optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(50, 'Máximo 50 caracteres').optional(),
  description: z.string().trim().max(255).optional().nullable(),
});
