import { Router } from 'express';
import {
  handleCreateMovement,
  handleGetMovements,
  handleGetSummary,
  handleGetLowStock,
} from './inventory.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

// All inventory operations require valid authentication and active organization membership
router.use(requireAuth);

// Summary metrics & low stock queries
router.get('/summary', handleGetSummary);
router.get('/low-stock', handleGetLowStock);

// Kardex ledger movements
router.get('/movements', handleGetMovements);

// Manual stock movement creation (OWNER only)
router.post('/movements', requireRole(['OWNER']), handleCreateMovement);

export default router;
