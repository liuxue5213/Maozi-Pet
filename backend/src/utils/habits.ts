/**
 * 帽子AI宠物 - 习惯打卡纯函数
 * 现实习惯每日打卡 → 宠物 +心情 +小额金币（对标 Finch/OtterLife：用户为宠物照顾自己）
 * 全部为纯函数（DB 注入式调用方见 routes/habits.ts）
 */
import { todayStr } from './today';

/** 同时进行的习惯上限（聚焦，防清单化） */
export const MAX_HABITS = 3;
/** 每次打卡宠物心情加成 */
export const CHECK_MOOD = 5;
/** 每次打卡金币奖励（3 习惯 × 2 = 日上限 +6，不与 200 互动预算互通，微量防通胀） */
export const CHECK_COINS = 2;

/**
 * streak 里程碑 → 宠物成长绑定（对标 Habit-chi/Pawbit「streak 驱动宠物进化」）。
 * 每个习惯每个里程碑只发一次经验（awarded_milestones 持久化防断签重爬刷经验），
 * 达成即解锁对应成就徽章（徽章管线自动 +💎5，见 achievements.ts habitStreak 指标）。
 */
export interface MilestoneDef {
  days: number;
  exp: number;
  title: string;
  icon: string;
}

export const MILESTONE_DEFS: MilestoneDef[] = [
  { days: 3, exp: 15, title: '三日之约', icon: '🌱' },
  { days: 7, exp: 40, title: '七日之燃', icon: '🔥' },
  { days: 14, exp: 100, title: '十四日星辰', icon: '🌟' },
  { days: 21, exp: 200, title: '廿一日之冠', icon: '👑' },
];

/**
 * streak 已达到的里程碑中「未发放过的最高一个」。
 * 用 >= 而非 === 匹配：无宠物/睡觉窗口错过发放日时，之后打卡可补发，
 * awarded 集合保证每个里程碑终身只发一次。
 */
export function pendingMilestone(streak: number, awarded: Set<number>): MilestoneDef | null {
  let best: MilestoneDef | null = null;
  for (const def of MILESTONE_DEFS) {
    if (streak >= def.days && !awarded.has(def.days)) best = def;
  }
  return best;
}

/** streak 之后最近一个未达成里程碑（前端进度提示） */
export function nextMilestone(streak: number): MilestoneDef | null {
  return MILESTONE_DEFS.find(def => def.days > streak) || null;
}

/** awarded_milestones 列（'3,7'）→ 集合；脏数据安全 */
export function parseAwarded(text: string | null | undefined): Set<number> {
  if (!text) return new Set();
  return new Set(
    String(text)
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isInteger(n) && n > 0)
  );
}

export function serializeAwarded(awarded: Set<number>): string {
  return [...awarded].sort((a, b) => a - b).join(',');
}

/** 'YYYY-MM-DD' → 本地 Date 零点（解析为本地时区，避免 UTC 偏移跨日） */
function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayStr(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** 某天的前一天（本地口径，setDate 自动处理跨月/跨年） */
export function prevDay(day: string): string {
  const d = parseDay(day);
  d.setDate(d.getDate() - 1);
  return dayStr(d);
}

/**
 * 连续打卡天数：从今天往前数的连续天数（set 去重、无序输入安全）。
 * 今天还没打卡时，若昨天在集合中 streak 仍存活（从昨天起算）——
 * 即「昨天连着打了、今天还没来得及」不会显示断签，打卡后延续。
 */
export function calcStreak(checkinDays: string[], today: string = todayStr()): number {
  const set = new Set(checkinDays);
  let cursor = set.has(today) ? today : prevDay(today);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  return streak;
}
