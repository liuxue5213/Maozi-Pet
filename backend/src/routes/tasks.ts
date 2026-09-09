/**
 * 帽子AI宠物 - 每日任务路由
 * GET /api/tasks/daily            当日任务与进度
 * POST /api/tasks/daily/:id/claim 领取已完成任务的奖励
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { getDailyTasks, claimTask } from '../utils/tasks';
import db from '../db';

export const tasksRouter = Router();

// 当日任务列表（含进度/领取状态）
tasksRouter.get('/daily', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const tasks = getDailyTasks(userId);
  res.json({
    tasks,
    allClaimed: tasks.every(t => t.claimed),
  });
});

// 领取任务奖励（条件更新防并发重复领取）
tasksRouter.post('/daily/:taskId/claim', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { taskId } = req.params;

  try {
    const reward = claimTask(userId, taskId);
    const coins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins ?? 0;
    res.json({ message: `任务完成！获得 🪙 ${reward}`, reward, totalCoins: coins });
  } catch (err: any) {
    res.status(400).json({ error: err.message || '领取失败' });
  }
});
