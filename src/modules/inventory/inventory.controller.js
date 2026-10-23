import {
  createStockMovement,
  getStockMovements,
  getInventorySummary,
  getLowStockProducts,
} from './inventory.service.js';
import {
  createMovementSchema,
  queryMovementsSchema,
} from './inventory.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleCreateMovement(req, res, next) {
  try {
    const validatedData = createMovementSchema.parse(req.body);
    const result = await createStockMovement({
      organizationId: req.organizationId,
      userId: req.user.id,
      ...validatedData,
    });
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

export async function handleGetMovements(req, res, next) {
  try {
    const query = queryMovementsSchema.parse(req.query);
    const result = await getStockMovements({
      organizationId: req.organizationId,
      ...query,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetSummary(req, res, next) {
  try {
    const summary = await getInventorySummary(req.organizationId);
    return successResponse(res, summary);
  } catch (error) {
    next(error);
  }
}

export async function handleGetLowStock(req, res, next) {
  try {
    const products = await getLowStockProducts(req.organizationId);
    return successResponse(res, products);
  } catch (error) {
    next(error);
  }
}
