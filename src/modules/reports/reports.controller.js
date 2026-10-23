import { getFinancialReport } from './reports.service.js';
import { queryReportsSchema } from './reports.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleGetFinancialReport(req, res, next) {
  try {
    const query = queryReportsSchema.parse(req.query);
    const report = await getFinancialReport({
      organizationId: req.organizationId,
      ...query,
    });
    return successResponse(res, report);
  } catch (error) {
    next(error);
  }
}
