import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Debe ser un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  organizationName: z
    .string()
    .trim()
    .min(2, 'El nombre de la organización debe tener al menos 2 caracteres'),
  currency: z.string().trim().default('GTQ'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Debe ser un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});
