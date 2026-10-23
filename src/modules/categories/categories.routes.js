import { Router } from 'express';
import {
  handleGetCategories,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from './categories.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get('/', handleGetCategories);
categoriesRouter.post('/', requireRole('OWNER'), handleCreateCategory);
categoriesRouter.patch('/:id', requireRole('OWNER'), handleUpdateCategory);
categoriesRouter.delete('/:id', requireRole('OWNER'), handleDeleteCategory);
