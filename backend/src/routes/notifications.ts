/**
 * 帽子AI宠物 - 站内通知路由
 * GET  /api/notifications       列表（最新 30 条）+ 未读数
 * POST /api/notifications/read  全部标记已读
 */
import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const items = db.prepare(`
    SELECT id, type, content, is_read, created_at
    FROM notifications WHERE user_id = ?
    ORDER BY id DESC LIMIT 30
  `).all(userId) as any[];

  const unreadCount = (db.prepare(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId) as any).n;

  res.json({ items, unreadCount });
});

notificationsRouter.post('/read', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(userId);
  res.json({ message: '已全部标记为已读' });
});
