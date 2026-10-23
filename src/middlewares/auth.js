import { verifyToken, COOKIE_NAME } from '../utils/token.js';
import { prisma } from '../config/prisma.js';
import { errorResponse } from '../utils/response.js';

export async function requireAuth(req, res, next) {
  // 1. Extract token from HttpOnly cookie or Authorization Bearer header
  let token = req.cookies?.[COOKIE_NAME];

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return errorResponse(res, {
      code: 'UNAUTHORIZED',
      message: 'Se requiere autenticación para acceder a este recurso.',
      statusCode: 401,
    });
  }

  // 2. Verify JWT signature and payload
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return errorResponse(res, {
      code: 'INVALID_TOKEN',
      message: 'La sesión es inválida o ha expirado.',
      statusCode: 401,
    });
  }

  // 3. Query user and active memberships from DB
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    return errorResponse(res, {
      code: 'USER_NOT_FOUND',
      message: 'El usuario de la sesión ya no existe.',
      statusCode: 401,
    });
  }

  // 4. Attach sanitized user (never leak passwordHash)
  const { passwordHash, ...safeUser } = user;
  req.user = safeUser;

  // 5. Select active organization (from header x-organization-id or first membership)
  const requestedOrgId = req.headers['x-organization-id'];
  let activeMembership = null;

  if (requestedOrgId) {
    activeMembership = user.memberships.find((m) => m.organizationId === requestedOrgId);
    if (!activeMembership) {
      return errorResponse(res, {
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'No tienes acceso a la organización especificada.',
        statusCode: 403,
      });
    }
  } else if (user.memberships.length > 0) {
    activeMembership = user.memberships[0];
  }

  req.membership = activeMembership;
  req.organizationId = activeMembership?.organizationId || null;

  next();
}

export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.membership) {
      return errorResponse(res, {
        code: 'NO_MEMBERSHIP',
        message: 'El usuario no tiene una membresía u organización activa.',
        statusCode: 403,
      });
    }

    if (!roles.includes(req.membership.role)) {
      return errorResponse(res, {
        code: 'FORBIDDEN_ROLE',
        message: `Esta acción requiere rol de: ${roles.join(' o ')}.`,
        statusCode: 403,
      });
    }

    next();
  };
}
