import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { generateToken } from '../../utils/token.js';

export async function registerUser({ name, email, password, organizationName, currency = 'GTQ' }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Verify email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error = new Error('El correo electrónico ya se encuentra registrado.');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  // 2. Hash password securely
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Atomically create User, Organization, and OWNER Membership
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: organizationName.trim(),
        currency: currency.trim() || 'GTQ',
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    });

    return { user, organization, membership };
  });

  // 4. Generate JWT
  const token = generateToken({
    userId: result.user.id,
  });

  const { passwordHash: _, ...safeUser } = result.user;

  return {
    user: {
      ...safeUser,
      memberships: [
        {
          id: result.membership.id,
          role: result.membership.role,
          organization: result.organization,
        },
      ],
    },
    token,
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error('Credenciales incorrectas.');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // 2. Validate password hash
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    const error = new Error('Credenciales incorrectas.');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // 3. Generate JWT
  const token = generateToken({
    userId: user.id,
  });

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    token,
  };
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error('Usuario no encontrado.');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}
