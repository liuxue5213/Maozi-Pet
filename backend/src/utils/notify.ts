/**
 * 帽子AI宠物 - 站内通知（点赞/评论/串门互动提醒）
 * 设计：只通知「别人对我做的事」（自己操作不通知）；同一人对同一目标未读去重；
 * 每用户保留最新 50 条（插入后修剪），防无限增长。
 */
import db from '../db';

export type NotifyType = 'like' | 'comment' | 'visit';

/** 写入通知：自操作跳过；未读重复（同人同类型）只刷新时间不堆叠；修剪到 50 条 */
export function pushNotification(userId: string, actorId: string | null, type: NotifyType, content: string): void {
  if (actorId && actorId === userId) return;

  const dup = db.prepare(
    'SELECT id FROM notifications WHERE user_id = ? AND type = ? AND is_read = 0 AND actor_id IS ?'
  ).get(userId, type, actorId ?? null) as any;
  const now = new Date().toISOString();
  if (dup) {
    db.prepare('UPDATE notifications SET content = ?, created_at = ? WHERE id = ?').run(content, now, dup.id);
  } else {
    db.prepare(
      'INSERT INTO notifications (user_id, actor_id, type, content, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(userId, actorId, type, content, now);
  }

  // 修剪：只保留最新 50 条
  db.prepare(`
    DELETE FROM notifications WHERE user_id = ? AND id NOT IN (
      SELECT id FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50
    )
  `).run(userId, userId);
}
