/**
 * 帽子AI宠物 - 每日任务系统
 * 任务定义 + 进度推进 + 状态查询（按自然日刷新，跨天自动归零）
 * 所有函数支持注入 database（默认全局实例），便于内存库单元测试
 */
import db from '../db';
import type { Database as DatabaseType } from 'better-sqlite3';
import { todayStr } from './today';

export interface TaskDef {
  taskId: string;
  title: string;
  target: number;
  reward: number;
}

export const TASK_DEFS: TaskDef[] = [
  { taskId: 'feed1', title: '喂食 1 次', target: 1, reward: 10 },
  { taskId: 'chat1', title: '和帽子聊 1 句', target: 1, reward: 15 },
  { taskId: 'interact3', title: '和帽子互动 3 次', target: 3, reward: 20 },
];

const DEF_MAP = new Map(TASK_DEFS.map(t => [t.taskId, t]));

/** 推进任务进度（到达 target 后不再累加）；单个语句原子，失败静默 */
export function bumpTaskProgress(userId: string, taskId: string, database: DatabaseType = db): void {
  const def = DEF_MAP.get(taskId);
  if (!def) return;
  try {
    database.prepare(`
      INSERT INTO task_progress (user_id, task_date, task_id, progress, claimed)
      VALUES (?, ?, ?, 1, 0)
      ON CONFLICT(user_id, task_date, task_id)
      DO UPDATE SET progress = MIN(progress + 1, ${def.target})
    `).run(userId, todayStr(), taskId);
  } catch {
    // 任务进度失败不影响主流程
  }
}

export interface DailyTaskState extends TaskDef {
  progress: number;
  claimed: boolean;
  done: boolean;
}

export function getDailyTasks(userId: string, database: DatabaseType = db): DailyTaskState[] {
  const rows = database.prepare(`
    SELECT task_id, progress, claimed FROM task_progress
    WHERE user_id = ? AND task_date = ?
  `).all(userId, todayStr()) as any[];
  const rowMap = new Map(rows.map(r => [r.task_id, r]));

  return TASK_DEFS.map(def => {
    const row = rowMap.get(def.taskId);
    const progress = Math.min(row?.progress ?? 0, def.target);
    return {
      ...def,
      progress,
      claimed: !!row?.claimed,
      done: progress >= def.target,
    };
  });
}

/** 领取奖励：返回金币变动额；抛错携带用户可读信息由路由层转 400 */
export function claimTask(userId: string, taskId: string, database: DatabaseType = db): number {
  const def = DEF_MAP.get(taskId);
  if (!def) throw new Error('任务不存在');

  const row = database.prepare(`
    SELECT progress, claimed FROM task_progress
    WHERE user_id = ? AND task_date = ? AND task_id = ?
  `).get(userId, todayStr(), taskId) as any;

  if (!row || row.progress < def.target) throw new Error('任务还未完成');
  if (row.claimed) throw new Error('今天已经领取过了');

  const result = database.prepare(`
    UPDATE task_progress SET claimed = 1
    WHERE user_id = ? AND task_date = ? AND task_id = ? AND claimed = 0 AND progress >= ?
  `).run(userId, todayStr(), taskId, def.target);
  if (result.changes === 0) throw new Error('今天已经领取过了');

  database.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(def.reward, userId);
  return def.reward;
}
