import { Router } from 'express';
import {
  handleGetProducts,
  handleGetProductById,
  handleCreateProduct,
  handleUpdateProduct,
  handleToggleProductStatus,
} from './products.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get('/', handleGetProducts);
productsRouter.get('/:id', handleGetProductById);
productsRouter.post('/', requireRole('OWNER'), handleCreateProduct);
productsRouter.patch('/:id', requireRole('OWNER'), handleUpdateProduct);
productsRouter.patch('/:id/status', requireRole('OWNER'), handleToggleProductStatus);
