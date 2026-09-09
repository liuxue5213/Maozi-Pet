/**
 * 帽子AI宠物 - 成就徽章系统
 * 从既有数据源（互动/聊天/好友/串门/猜拳/成长）计算达成情况，零新增埋点
 * 纯函数评估器可单测；DB 聚合在路由层
 */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** 达成条件：对应 metrics 键 >= threshold */
  metric: string;
  threshold: number;
}

/** 每枚新解锁徽章发放的钻石（钻石专属商城商品的唯一获取渠道） */
export const DIAMOND_PER_ACHIEVEMENT = 5;

/** 成就定义（metric 与 collectMetrics() 的键一一对应） */
export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_meet', title: '初次见面', description: '完成第一次互动', icon: '🐾', metric: 'interactions', threshold: 1 },
  { id: 'companion_100', title: '陪伴达人', description: '累计互动 100 次', icon: '🤝', metric: 'interactions', threshold: 100 },
  { id: 'companion_300', title: '形影不离', description: '累计互动 300 次', icon: '💞', metric: 'interactions', threshold: 300 },
  { id: 'chatty_10', title: '聊得来', description: '和帽子聊过 10 句', icon: '💬', metric: 'chats', threshold: 10 },
  { id: 'chatty_50', title: '话痨搭档', description: '和帽子聊过 50 句', icon: '🗣️', metric: 'chats', threshold: 50 },
  { id: 'social_first', title: '迈出一步', description: '添加第一位好友', icon: '👋', metric: 'friends', threshold: 1 },
  { id: 'social_3', title: '社交蝴蝶', description: '拥有 3 位好友', icon: '🦋', metric: 'friends', threshold: 3 },
  { id: 'visit_1', title: '好客之道', description: '第一次串门互动', icon: '🏠', metric: 'visitInteractions', threshold: 1 },
  { id: 'rps_first_win', title: '猜拳新手', description: '猜拳赢下第一局', icon: '✊', metric: 'rpsWins', threshold: 1 },
  { id: 'rps_10_win', title: '猜拳小王者', description: '猜拳累计赢 10 局', icon: '👑', metric: 'rpsWins', threshold: 10 },
  { id: 'rich_500', title: '小有积蓄', description: '持有金币达到 500', icon: '🪙', metric: 'coins', threshold: 500 },
  { id: 'grown_adult', title: '长大成人', description: '一只宠物成长为成年', icon: '🌱', metric: 'adultPets', threshold: 1 },
  { id: 'first_retire', title: '温情养老', description: '送第一只宠物光荣退休', icon: '🌟', metric: 'retiredPets', threshold: 1 },
  // habitStreak：全部习惯（含归档）的最高连续打卡天数（streak → 宠物成长绑定，Round 18）
  { id: 'habit_3', title: '三日之约', description: '任意习惯连续打卡 3 天', icon: '🌱', metric: 'habitStreak', threshold: 3 },
  { id: 'habit_7', title: '七日之燃', description: '任意习惯连续打卡 7 天', icon: '🔥', metric: 'habitStreak', threshold: 7 },
  { id: 'habit_14', title: '十四日星辰', description: '任意习惯连续打卡 14 天', icon: '🌟', metric: 'habitStreak', threshold: 14 },
  { id: 'habit_21', title: '廿一日之冠', description: '任意习惯连续打卡 21 天', icon: '👑', metric: 'habitStreak', threshold: 21 },
];

const DEF_BY_METRIC = new Map<string, AchievementDef[]>();
for (const def of ACHIEVEMENT_DEFS) {
  const list = DEF_BY_METRIC.get(def.metric) || [];
  list.push(def);
  DEF_BY_METRIC.set(def.metric, list);
}

export type AchievementMetrics = Record<string, number>;

/** 根据指标评估：返回所有已达成（不含历史已解锁过滤，由调用方做差集）的成就 ID */
export function evaluateAchievements(metrics: AchievementMetrics): string[] {
  const unlocked: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if ((metrics[def.metric] ?? 0) >= def.threshold) unlocked.push(def.id);
  }
  return unlocked;
}

/** 新解锁 = 当前达成 - 历史已有 */
export function diffNewlyUnlocked(currentlyAchieved: string[], alreadyUnlocked: string[]): string[] {
  const known = new Set(alreadyUnlocked);
  return currentlyAchieved.filter(id => !known.has(id));
}
