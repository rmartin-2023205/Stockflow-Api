import { registerUser, loginUser, getCurrentUser } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { successResponse } from '../../utils/response.js';
import { setAuthCookie, clearAuthCookie } from '../../utils/token.js';

export async function handleRegister(req, res, next) {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { user, token } = await registerUser(validatedData);

    setAuthCookie(res, token);

    return successResponse(
      res,
      {
        user,
        token,
      },
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function handleLogin(req, res, next) {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, token } = await loginUser(validatedData);

    setAuthCookie(res, token);

    return successResponse(res, {
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleLogout(req, res) {
  clearAuthCookie(res);
  return successResponse(res, {
    message: 'Sesión cerrada correctamente.',
  });
}

export async function handleGetMe(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    return successResponse(res, {
      user,
      activeMembership: req.membership || null,
      activeOrganizationId: req.organizationId || null,
    });
  } catch (error) {
    next(error);
  }
}
