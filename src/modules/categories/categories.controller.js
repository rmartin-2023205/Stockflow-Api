import { getCategories, createCategory, updateCategory, deleteCategory } from './categories.service.js';
import { createCategorySchema, updateCategorySchema } from './categories.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleGetCategories(req, res, next) {
  try {
    const categories = await getCategories(req.organizationId);
    return successResponse(res, categories);
  } catch (error) {
    next(error);
  }
}

export async function handleCreateCategory(req, res, next) {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    const category = await createCategory({
      organizationId: req.organizationId,
      ...validatedData,
    });
    return successResponse(res, category, 201);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateCategory(req, res, next) {
  try {
    const validatedData = updateCategorySchema.parse(req.body);
    const category = await updateCategory({
      organizationId: req.organizationId,
      categoryId: req.params.id,
      ...validatedData,
    });
    return successResponse(res, category);
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCategory(req, res, next) {
  try {
    const result = await deleteCategory({
      organizationId: req.organizationId,
      categoryId: req.params.id,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}
