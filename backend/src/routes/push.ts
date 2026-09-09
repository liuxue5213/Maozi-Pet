/**
 * 帽子AI宠物 - 推送路由
 * POST /api/push/register  注册设备令牌
 * POST /api/push/dispatch  手动触发一次照料推送扫描（默认由定时器自动执行）
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import db from '../db';
import { registerPushToken, dispatchPetCarePushes, parseQuietTime } from '../utils/push';

export const pushRouter = Router();

// 免打扰时段：查看 / 设置（"HH:MM" 起止，传 null 清除；start > end = 跨零点窗口）
pushRouter.get('/settings', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const row = db.prepare('SELECT push_quiet_start, push_quiet_end FROM users WHERE id = ?').get(userId) as any;
  res.json({ quietStart: row?.push_quiet_start || null, quietEnd: row?.push_quiet_end || null });
});

pushRouter.post('/settings', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { quietStart, quietEnd } = req.body ?? {};

  // 免打扰时段不合法/只传一头 → 视为关闭（两端都需为合法 HH:MM 才生效）
  const start = parseQuietTime(quietStart);
  const end = parseQuietTime(quietEnd);
  const effectiveStart = start && end ? start : null;
  const effectiveEnd = start && end ? end : null;

  db.prepare('UPDATE users SET push_quiet_start = ?, push_quiet_end = ? WHERE id = ?')
    .run(effectiveStart, effectiveEnd, userId);

  res.json({
    message: effectiveStart ? `🌙 免打扰时段已设为 ${effectiveStart} ~ ${effectiveEnd}` : '免打扰已关闭，帽子随时可以找你',
    quietStart: effectiveStart,
    quietEnd: effectiveEnd,
  });
});

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
