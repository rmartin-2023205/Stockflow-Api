import { Router } from 'express';
import {
  handleCreateSale,
  handleGetSales,
  handleGetSaleById,
  handleCancelSale,
} from './sales.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

// All POS operations require authenticated user with active organization
router.use(requireAuth);

// Query sales history
router.get('/', handleGetSales);
router.get('/:id', handleGetSaleById);

// Create sale (CASHIER & OWNER)
router.post('/', handleCreateSale);

// Cancel sale (OWNER only)
router.post('/:id/cancel', requireRole('OWNER'), handleCancelSale);

export default router;
