import { Router } from 'express';
import { handleGetFinancialReport } from './reports.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

// Executive financial reports (OWNER only)
router.get('/', requireRole('OWNER'), handleGetFinancialReport);

export default router;
