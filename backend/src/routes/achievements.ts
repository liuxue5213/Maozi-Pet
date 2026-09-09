/**
 * 帽子AI宠物 - 成就徽章路由
 * GET /api/achievements 评估并返回全部成就（解锁时间/新解锁标记）
 * 惰性评估：查询时重新计算并持久化新解锁（无定时任务依赖）
 */
import { Router, Request, Response } from 'express';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { ACHIEVEMENT_DEFS, evaluateAchievements, diffNewlyUnlocked, AchievementMetrics } from '../utils/achievements';

export const achievementsRouter = Router();

/** 从既有数据源聚合指标（一次查询一个数，量级都是个位数查询） */
function collectMetrics(userId: string): AchievementMetrics {
  const one = (sql: string, ...params: any[]): number => {
    const row = db.prepare(sql).get(...params) as any;
    return row?.v ?? 0;
  };

  return {
    // 互动总数（所有宠物累计，含退休）
    interactions: one(`SELECT COALESCE(SUM(total_interactions), 0) as v FROM pets WHERE user_id = ?`, userId),
    // 聊天句数（全部对话历史）
    chats: one(`SELECT COUNT(*) as v FROM chat_messages WHERE user_id = ? AND role = 'user'`, userId),
    friends: one(`SELECT COUNT(*) as v FROM friendships WHERE user_id = ?`, userId),
    visitInteractions: one(`SELECT COUNT(*) as v FROM friend_visit_interactions WHERE visitor_id = ?`, userId),
    rpsWins: one(`SELECT COALESCE(SUM(win_count), 0) as v FROM rps_daily WHERE user_id = ?`, userId),
    coins: one(`SELECT coins as v FROM users WHERE id = ?`, userId),
    adultPets: one(`SELECT COUNT(*) as v FROM pets WHERE user_id = ? AND stage = 'adult'`, userId),
    retiredPets: one(`SELECT COUNT(*) as v FROM pets WHERE user_id = ? AND is_retired = 1`, userId),
  };
}

achievementsRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const metrics = collectMetrics(userId);
  const achieved = evaluateAchievements(metrics);

  const existing = (db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
    .all(userId) as any[]).map(r => r.achievement_id);
  const newly = diffNewlyUnlocked(achieved, existing);

  // 持久化新解锁（事务；键冲突静默跳过）
  if (newly.length > 0) {
    const now = new Date().toISOString();
    transaction((tx) => {
      for (const id of newly) {
        tx.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)')
          .run(userId, id, now);
      }
    });
  }

  const unlockedMap = new Map<string, string>();
  (db.prepare('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?')
    .all(userId) as any[]).forEach(r => unlockedMap.set(r.achievement_id, r.unlocked_at));

  res.json({
    achievements: ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked: unlockedMap.has(def.id),
      unlockedAt: unlockedMap.get(def.id) || null,
    })),
    unlockedCount: unlockedMap.size,
    totalCount: ACHIEVEMENT_DEFS.length,
    newCount: newly.length,
    metrics,
  });
});
