/**
 * Reporting Controller
 *
 * Handlers for Admin reporting endpoints.
 * All tenant scoping is derived server-side from the authenticated ADMIN's live DB record.
 * The frontend MUST NOT send businessUuid, clubUuid, tenantId, or businessId.
 */

import { Request, Response, NextFunction } from 'express';
import { ReportingService } from './reporting.service';
import { AdminReportQueryParams, AdminExportQueryParams } from './reporting.interface';

export class ReportingController {
  constructor(private reportingService: ReportingService = new ReportingService()) {}

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/overview
  // ─────────────────────────────────────────────────────────────
  getAdminOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminOverview(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/revenue
  // ─────────────────────────────────────────────────────────────
  getAdminRevenue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminRevenue(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/orders
  // ─────────────────────────────────────────────────────────────
  getAdminOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminOrders(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/payments
  // ─────────────────────────────────────────────────────────────
  getAdminPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminPayments(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/products
  // ─────────────────────────────────────────────────────────────
  getAdminProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminProducts(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/categories
  // ─────────────────────────────────────────────────────────────
  getAdminCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminCategories(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/waiters
  // ─────────────────────────────────────────────────────────────
  getAdminWaiters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminReportQueryParams;

      const data = await this.reportingService.getAdminWaiters(adminUserId, query);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/admin/export
  // ─────────────────────────────────────────────────────────────
  exportAdminReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminUserId = req.user!.userId;
      const query = req.query as unknown as AdminExportQueryParams;
      const ipAddress = req.ip || req.socket?.remoteAddress;

      const { filename, csv } = await this.reportingService.exportAdminReport(
        adminUserId,
        query,
        ipAddress,
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // GET /api/v1/reports/manager/waiters
  // ─────────────────────────────────────────────────────────────
  getManagerWaiters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const managerUserId = req.user!.userId;
      const query = req.query as unknown as { range?: string; startDate?: string; endDate?: string };

      const data = await this.reportingService.getManagerWaiters(managerUserId, query as any);

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LEGACY: GET /reports/analytics
  // ─────────────────────────────────────────────────────────────
  getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = (req.user?.role || '').toUpperCase();
      let businessUuid: string;

      if (userRole === 'SUPER_ADMIN') {
        businessUuid =
          (req.query.businessUuid as string) ||
          (req.query.clubUuid as string) ||
          req.businessUuid ||
          req.user?.businessUuid ||
          'ALL';
      } else {
        businessUuid = req.user?.businessUuid || req.businessUuid || '';

        if (!businessUuid) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'User is not assigned to a business tenant' },
          });
          return;
        }
      }

      const period = (req.query.period as any) || 'MONTHLY';
      const format = (req.query.format as string) || 'JSON';

      const data = await this.reportingService.generateAnalyticsReport(businessUuid, period);

      if (format === 'CSV') {
        const csvContent = this.reportingService.generateCsvReport(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Analytics_Report_${period}_${Date.now()}.csv`);
        res.send(csvContent);
        return;
      }

      res.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString(), version: 'v1' },
      });
    } catch (error) {
      next(error);
    }
  };
}
