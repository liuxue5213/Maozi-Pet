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
