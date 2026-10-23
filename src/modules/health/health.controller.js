import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { successResponse } from '../../utils/response.js';

export async function getHealth(req, res) {
  let dbStatus = 'disconnected';
  
  try {
    // Perform quick ping query to verify database connection
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  return successResponse(res, {
    status: 'ok',
    environment: env.NODE_ENV,
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
