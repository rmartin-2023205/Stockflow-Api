import { getDashboardSummary } from './dashboard.service.js';
import { successResponse } from '../../utils/response.js';

export async function handleGetDashboardSummary(req, res, next) {
  try {
    const summary = await getDashboardSummary(req.organizationId);
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
}
