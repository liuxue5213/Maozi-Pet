/**
 * 帽子AI宠物 - 令牌与过期数据清理
 * auth_tokens 表随登录持续增长，过期记录无业务价值（校验时会因过期被拒），
 * 定期清理防止表无限膨胀。
 */
import db from '../db';

/** 删除已过期的登录令牌，返回清理条数 */
export function cleanupExpiredTokens(): number {
  return db.prepare('DELETE FROM auth_tokens WHERE expires_at <= ?')
    .run(new Date().toISOString()).changes;
}

/**
 * 启动时立即清理一次，此后每 6 小时清理一次。
 * 供 index.ts 调用。
 */
export function startTokenCleanupLoop(): void {
  try {
    const n = cleanupExpiredTokens();
    if (n > 0) console.log(`🧹 已清理 ${n} 条过期登录令牌`);
  } catch (err: any) {
    console.error('令牌清理失败:', err.message);
  }
  setInterval(() => {
    try {
      cleanupExpiredTokens();
    } catch (err: any) {
      console.error('令牌清理失败:', err.message);
    }
  }, 6 * 60 * 60 * 1000);
}
