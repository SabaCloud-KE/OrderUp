import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { prisma } from '../../config/prisma';
import { Permission, UserRole, hasPermission, normalizeRole } from '@orderup/shared';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      businessUuid?: string;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token required');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);

    // Validate that the token's role is a recognized, valid active role
    try {
      normalizeRole(payload.role);
    } catch {
      throw new UnauthorizedError('Invalid, malformed, or deprecated role in token. Please log in again.');
    }

    req.user = payload;
    req.businessUuid = payload.businessUuid || payload.tenantId;

    // Asynchronously touch user's active session to keep online status fresh
    if (payload.userId) {
      prisma.userSession.updateMany({
        where: {
          userUuid: payload.userId,
          isValid: true,
          expiresAt: { gt: new Date() },
        },
        data: {
          updatedAt: new Date(),
        },
      }).catch(() => {});
    }

    next();
  } catch (err: any) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
};

export const authorize = (roles: (UserRole | string)[]) => {
  const normalizedAllowedRoles = roles.map((r) => normalizeRole(r as string));
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    let userRole: UserRole;
    try {
      userRole = normalizeRole(req.user.role);
    } catch {
      throw new ForbiddenError('Invalid user role');
    }
    if (!normalizedAllowedRoles.includes(userRole)) {
      throw new ForbiddenError('Insufficient permissions for this resource');
    }
    next();
  };
};

export const requirePermission = (permission: Permission | Permission[]) => {
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const hasAll = requiredPermissions.every((p) => hasPermission(req.user!.role, p));
    if (!hasAll) {
      throw new ForbiddenError(`Missing required permission: ${requiredPermissions.join(', ')}`);
    }
    next();
  };
};

export const requireTenantScope = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  let userRole: UserRole;
  try {
    userRole = normalizeRole(req.user.role);
  } catch {
    throw new ForbiddenError('Invalid user role');
  }
  if (userRole === UserRole.SUPER_ADMIN) {
    // Super admin can optionally target a business via header or query
    req.businessUuid = (req.headers['x-business-uuid'] as string) || (req.query.businessUuid as string) || req.businessUuid;
    return next();
  }

  const businessUuid = req.user.businessUuid || req.user.tenantId;
  if (!businessUuid) {
    throw new ForbiddenError('User is not associated with any business tenant');
  }
  req.businessUuid = businessUuid;
  next();
};

