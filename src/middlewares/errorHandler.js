import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { errorResponse } from '../utils/response.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  // If response headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Zod validation errors
  if (err instanceof ZodError) {
    return errorResponse(res, {
      code: 'VALIDATION_ERROR',
      message: 'Los datos proporcionados no son válidos.',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      statusCode: 400,
    });
  }

  // 2. Prisma specific errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (e.g. SKU, email)
    if (err.code === 'P2002') {
      const target = err.meta?.target || 'campo';
      return errorResponse(res, {
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: `Ya existe un registro con el mismo valor para: ${Array.isArray(target) ? target.join(', ') : target}.`,
        statusCode: 409,
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      return errorResponse(res, {
        code: 'NOT_FOUND',
        message: 'El recurso solicitado no fue encontrado.',
        statusCode: 404,
      });
    }
  }

  // 3. Operational or custom errors with a status code
  if (err.statusCode) {
    return errorResponse(res, {
      code: err.code || 'OPERATIONAL_ERROR',
      message: err.message || 'Error en la solicitud.',
      details: err.details || null,
      statusCode: err.statusCode,
    });
  }

  // 4. Fallback unexpected errors
  console.error('Unhandled Server Error:', err);

  return errorResponse(res, {
    code: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production'
      ? 'Ocurrió un error interno en el servidor.'
      : err.message || 'Ocurrió un error interno en el servidor.',
    statusCode: 500,
  });
}
