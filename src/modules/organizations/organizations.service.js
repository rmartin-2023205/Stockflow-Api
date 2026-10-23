import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';

export async function getOrganizationMembers(organizationId) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return memberships.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.createdAt,
    user: m.user,
  }));
}

export async function addOrganizationMember({
  organizationId,
  name,
  email,
  password,
  role = 'CASHIER',
}) {
  const normalizedEmail = email.trim().toLowerCase();

  return prisma.$transaction(async (tx) => {
    // 1. Check if user already exists
    let user = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
        },
      });
    }

    // 2. Check if already a member in this organization
    const existingMembership = await tx.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      const error = new Error('Este usuario ya es miembro de tu organización.');
      error.statusCode = 409;
      error.code = 'MEMBER_ALREADY_EXISTS';
      throw error;
    }

    // 3. Create membership
    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      id: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: membership.user,
    };
  });
}

export async function removeOrganizationMember({
  organizationId,
  membershipId,
  requestingUserId,
}) {
  const membership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
    },
  });

  if (!membership) {
    const error = new Error('Miembro no encontrado en esta organización.');
    error.statusCode = 404;
    error.code = 'MEMBERSHIP_NOT_FOUND';
    throw error;
  }

  // Prevent removing self if it leaves no owner
  if (membership.role === 'OWNER') {
    const ownerCount = await prisma.membership.count({
      where: {
        organizationId,
        role: 'OWNER',
      },
    });

    if (ownerCount <= 1) {
      const error = new Error('No puedes remover al único Propietario de la organización.');
      error.statusCode = 400;
      error.code = 'CANNOT_REMOVE_LAST_OWNER';
      throw error;
    }
  }

  await prisma.membership.delete({
    where: { id: membershipId },
  });

  return { message: 'Membresía revocada exitosamente.' };
}
