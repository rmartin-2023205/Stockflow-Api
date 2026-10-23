import {
  createSale,
  getSales,
  getSaleById,
  cancelSale,
} from './sales.service.js';
import {
  createSaleSchema,
  querySalesSchema,
  cancelSaleSchema,
} from './sales.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleCreateSale(req, res, next) {
  try {
    const validatedData = createSaleSchema.parse(req.body);
    const result = await createSale({
      organizationId: req.organizationId,
      cashierId: req.user.id,
      ...validatedData,
    });
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function handleGetSales(req, res, next) {
  try {
    const query = querySalesSchema.parse(req.query);
    const result = await getSales({
      organizationId: req.organizationId,
      ...query,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetSaleById(req, res, next) {
  try {
    const sale = await getSaleById({
      organizationId: req.organizationId,
      saleId: req.params.id,
    });
    return successResponse(res, sale);
  } catch (error) {
    next(error);
  }
}

export async function handleCancelSale(req, res, next) {
  try {
    const { reason } = cancelSaleSchema.parse(req.body);
    const sale = await cancelSale({
      organizationId: req.organizationId,
      userId: req.user.id,
      saleId: req.params.id,
      reason,
    });
    return successResponse(res, sale);
  } catch (error) {
    next(error);
  }
}
