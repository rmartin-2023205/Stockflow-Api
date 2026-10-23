import {
  getOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
} from './organizations.service.js';
import { createMemberSchema } from './organizations.schema.js';
import { successResponse } from '../../utils/response.js';

export async function handleGetMembers(req, res, next) {
  try {
    const members = await getOrganizationMembers(req.organizationId);
    return successResponse(res, members);
  } catch (error) {
    next(error);
  }
}

export async function handleAddMember(req, res, next) {
  try {
    const validatedData = createMemberSchema.parse(req.body);
    const member = await addOrganizationMember({
      organizationId: req.organizationId,
      ...validatedData,
    });
    return successResponse(res, member, 201);
  } catch (error) {
    next(error);
  }
}

export async function handleRemoveMember(req, res, next) {
  try {
    const result = await removeOrganizationMember({
      organizationId: req.organizationId,
      membershipId: req.params.id,
      requestingUserId: req.user.id,
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}
