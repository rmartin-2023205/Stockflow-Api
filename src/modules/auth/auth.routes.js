import { Router } from 'express';
import { handleRegister, handleLogin, handleLogout, handleGetMe } from './auth.controller.js';
import { requireAuth } from '../../middlewares/auth.js';

export const authRouter = Router();

authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/logout', handleLogout);
authRouter.get('/me', requireAuth, handleGetMe);
