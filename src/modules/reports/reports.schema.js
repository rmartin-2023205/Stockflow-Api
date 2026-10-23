import { z } from 'zod';

export const queryReportsSchema = z.object({
  period: z.enum(['today', '7days', '30days', 'month', 'custom']).default('7days'),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});
