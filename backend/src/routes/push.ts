/**
 * 帽子AI宠物 - 推送路由
 * POST /api/push/register  注册设备令牌
 * POST /api/push/dispatch  手动触发一次照料推送扫描（默认由定时器自动执行）
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { registerPushToken, dispatchPetCarePushes } from '../utils/push';

export const pushRouter = Router();

pushRouter.post('/register', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { token } = req.body ?? {};

  if (typeof token !== 'string' || !registerPushToken(userId, token)) {
    res.status(400).json({ error: '无效的推送令牌' });
    return;
  }
  res.json({ message: '推送已开启，帽子会想你的时候叫你~' });
});

pushRouter.post('/dispatch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await dispatchPetCarePushes();
    res.json({ message: '扫描完成', ...stats });
  } catch (err: any) {
    res.status(502).json({ error: '推送服务暂不可用', detail: err.message });
  }
});
