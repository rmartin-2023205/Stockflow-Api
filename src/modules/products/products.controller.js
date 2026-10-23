import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
} from './products.service.js';
import {
  createProductSchema,
  updateProductSchema,
  queryProductSchema,
} from './products.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleGetProducts(req, res, next) {
  try {
    const query = queryProductSchema.parse(req.query);
    const result = await getProducts({
      organizationId: req.organizationId,
      ...query,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetProductById(req, res, next) {
  try {
    const product = await getProductById({
      organizationId: req.organizationId,
      productId: req.params.id,
    });
    return successResponse(res, product);
  } catch (error) {
    next(error);
  }
}

export async function handleCreateProduct(req, res, next) {
  try {
    const validatedData = createProductSchema.parse(req.body);
    const product = await createProduct({
      organizationId: req.organizationId,
      userId: req.user.id,
      ...validatedData,
    });
    return successResponse(res, product, 201);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateProduct(req, res, next) {
  try {
    const validatedData = updateProductSchema.parse(req.body);
    const product = await updateProduct({
      organizationId: req.organizationId,
      productId: req.params.id,
      ...validatedData,
    });
    return successResponse(res, product);
  } catch (error) {
    next(error);
  }
}

export async function handleToggleProductStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    const product = await toggleProductStatus({
      organizationId: req.organizationId,
      productId: req.params.id,
      isActive,
    });
    return successResponse(res, product);
  } catch (error) {
    next(error);
  }
}
