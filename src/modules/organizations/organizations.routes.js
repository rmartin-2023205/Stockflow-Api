import { Router } from 'express';
import {
  handleGetMembers,
  handleAddMember,
  handleRemoveMember,
} from './organizations.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = Router();

router.use(requireAuth);

// Members management (OWNER only)
router.get('/members', requireRole('OWNER'), handleGetMembers);
router.post('/members', requireRole('OWNER'), handleAddMember);
router.delete('/members/:id', requireRole('OWNER'), handleRemoveMember);

export default router;
