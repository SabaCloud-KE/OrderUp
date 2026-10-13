import { Router } from 'express';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { UserRole } from '@orderup/shared';

const notificationRepository = new NotificationRepository();
const notificationService = new NotificationService(notificationRepository);
const notificationController = new NotificationController(notificationService);

export const notificationRouter = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Fetch user notifications & unread count for Notification Center
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications and unread count
 */
notificationRouter.get('/', authenticate, notificationController.getNotifications);

/**
 * @openapi
 * /notifications/{notificationUuid}/read:
 *   patch:
 *     summary: Mark single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationUuid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification updated
 */
notificationRouter.patch('/:notificationUuid/read', authenticate, notificationController.markAsRead);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
notificationRouter.post('/read-all', authenticate, notificationController.markAllAsRead);

/**
 * @openapi
 * /notifications/audit-logs:
 *   get:
 *     summary: Fetch system audit logs for compliance and security auditing
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of audit log entries
 */
notificationRouter.get(
  '/audit-logs',
  authenticate,
  authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  notificationController.getAuditLogs,
);
