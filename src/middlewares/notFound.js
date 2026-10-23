import { errorResponse } from '../utils/response.js';

export function notFoundHandler(req, res) {
  return errorResponse(res, {
    code: 'ROUTE_NOT_FOUND',
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada en este servidor.`,
    statusCode: 404,
  });
}
