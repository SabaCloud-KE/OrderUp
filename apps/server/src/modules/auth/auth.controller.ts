import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { UserRole, normalizeRole } from '@orderup/shared';

export class AuthController {

  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, username, password, rememberMe } = req.body;
      const identifier = (username || email || '').trim();
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await this.authService.login(identifier, password, rememberMe, ipAddress, userAgent);
      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const tokens = await this.authService.refreshToken(refreshToken);
      res.json({
        success: true,
        data: tokens,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }
      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerUserId = (req.user as any)?.userId || (req.user as any)?.id;
      const callerRole = normalizeRole((req.user as any)?.role);
      let callerBusinessUuid =
        req.businessUuid || (req.user as any)?.businessUuid || (req.user as any)?.tenantId || (req.user as any)?.clubUuid;

      let body = { ...req.body };
      const requestedRole = normalizeRole(body.role || UserRole.WAITER);

      // ── Strict User Creation Hierarchy Guards ─────────────────────────────
      // 1. SUPER_ADMIN can create ADMIN or other SUPER_ADMIN accounts
      if (callerRole === UserRole.SUPER_ADMIN) {
        if (requestedRole === UserRole.SUPER_ADMIN) {
          body.businessUuid = undefined;
          body.role = UserRole.SUPER_ADMIN;
        } else {
          body.role = requestedRole;
          body.businessUuid = body.businessUuid || body.clubUuid;
        }
      }
      // 2. ADMIN can create MANAGER (or WAITER) inside their own business ONLY
      else if (callerRole === UserRole.ADMIN) {
        if (requestedRole === UserRole.SUPER_ADMIN || requestedRole === UserRole.ADMIN) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Admins can only create Managers or Waiters for their own business' },
          });
          return;
        }

        if (!callerBusinessUuid && callerUserId) {
          const callerDbUser = await this.authService.getUserById(callerUserId);
          callerBusinessUuid = callerDbUser?.businessUuid;
        }

        if (!callerBusinessUuid) {
          res.status(400).json({
            success: false,
            error: { code: 'NO_BUSINESS', message: 'Your account is not assigned to a business.' },
          });
          return;
        }

        // Force businessUuid to Admin's business
        body.role = requestedRole === UserRole.WAITER ? UserRole.WAITER : UserRole.MANAGER;
        body.businessUuid = callerBusinessUuid;
      }
      // 3. MANAGER can ONLY create WAITER inside their own business
      else if (callerRole === UserRole.MANAGER) {
        if (requestedRole !== UserRole.WAITER) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Managers can only create Waiter accounts for their own business' },
          });
          return;
        }

        if (!callerBusinessUuid && callerUserId) {
          const callerDbUser = await this.authService.getUserById(callerUserId);
          callerBusinessUuid = callerDbUser?.businessUuid;
        }

        if (!callerBusinessUuid) {
          res.status(400).json({
            success: false,
            error: { code: 'NO_BUSINESS', message: 'Your account is not assigned to a business.' },
          });
          return;
        }

        body.role = UserRole.WAITER;
        body.businessUuid = callerBusinessUuid;
      }
      // 4. WAITER / CUSTOMER cannot create staff
      else {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have permission to create staff accounts' },
        });
        return;
      }

      const user = await this.authService.registerUser({
        ...body,
        actorUserUuid: callerUserId,
        ipAddress: req.ip,
      });
      res.status(201).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body;
      await this.authService.verifyEmail(token);
      res.json({
        success: true,
        data: { message: 'Email verified successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body;
      await this.authService.requestPasswordReset(email);
      res.json({
        success: true,
        data: { message: 'If an account exists, a reset link has been dispatched' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      await this.authService.resetPassword(token, newPassword);
      res.json({
        success: true,
        data: { message: 'Password has been reset successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  changeFirstLoginPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;
      await this.authService.changeFirstLoginPassword(userId!, currentPassword, newPassword);
      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(userId!, currentPassword, newPassword);
      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  listStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = normalizeRole(req.user?.role || '');
      const userBusinessUuid = req.businessUuid || req.user?.businessUuid || req.user?.tenantId;
      const { role } = req.query as { role?: string };

      let staff: any[];

      if (userRole === UserRole.SUPER_ADMIN) {
        const queryBizUuid = (req.query.businessUuid as string) || (req.query.clubUuid as string);
        if (queryBizUuid) {
          staff = await this.authService.listStaff(queryBizUuid, role);
        } else {
          staff = await this.authService.listAllStaff(role);
        }
      } else {
        if (!userBusinessUuid) {
          res.status(400).json({ success: false, error: { code: 'MISSING_BUSINESS', message: 'Business context is required' } });
          return;
        }
        staff = await this.authService.listStaff(userBusinessUuid, role);
      }

      res.json({
        success: true,
        data: { staff },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role, businessUuid, clubUuid, isActive, search } = req.query as {
        role?: string;
        businessUuid?: string;
        clubUuid?: string;
        isActive?: string;
        search?: string;
      };

      const finalBusinessUuid = businessUuid || clubUuid;
      const parsedIsActive = isActive !== undefined ? isActive === 'true' || isActive === '1' : undefined;

      const users = await this.authService.listAllUsers({
        role,
        businessUuid: finalBusinessUuid,
        isActive: parsedIsActive,
        search,
      });

      res.json({
        success: true,
        data: { users, total: users.length },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  toggleUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uuid } = req.params;
      const { isActive } = req.body as { isActive: boolean };

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, error: { code: 'INVALID_BODY', message: 'isActive must be a boolean' } });
        return;
      }

      await this.authService.setUserActive(uuid, isActive);

      res.json({
        success: true,
        data: { message: `User ${isActive ? 'activated' : 'deactivated'} successfully` },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  heartbeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (userId) {
        await this.authService.recordHeartbeat(userId);
      }
      res.json({
        success: true,
        data: { online: true },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uuid } = req.params;
      await this.authService.deleteUser(uuid);
      res.json({
        success: true,
        data: { message: 'User deleted successfully' },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uuid } = req.params;
      const { fullName, email, phone, businessUuid, clubUuid, isActive } = req.body;
      const updated = await this.authService.updateUserDetails(uuid, {
        fullName,
        email,
        phone,
        businessUuid: businessUuid || clubUuid,
        isActive,
      });

      res.json({
        success: true,
        data: {
          user: {
            uuid: updated.userUuid,
            fullName: updated.fullName,
            email: updated.email,
            phone: updated.phone,
            businessUuid: updated.businessUuid,
            clubUuid: updated.businessUuid,
            isActive: updated.isActive,
          },
          message: 'User details updated successfully',
        },
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };
}
