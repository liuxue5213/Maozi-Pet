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
 * streak 冻结券（对标 Duolingo streak freeze：宽宥机制保护长期积累，防断签焦虑而非制造焦虑）。
 * 漏打恰好 1 天时自动消费 1 张把断点桥接回去；连续漏 2 天不桥接（保护 ≠ 无限豁免）。
 * 每习惯上限 MAX_FREEZES 张，防囤积把「无压力」变「资产焦虑」。
 */
export const MAX_FREEZES = 2;
/** 里程碑达标各奖励 1 张（3 天档太早不给；7 天起正对第 2 周弃用高峰，habi.app 实测） */
export const MILESTONE_FREEZE_DAYS = [7, 14, 21];

/** calcStreakWithFreeze 的结果：streak 口径 + 本次新消费的冻结日期（调用方负责持久化） */
export interface FreezeStreak {
  streak: number;
  newFrozenDays: string[];
}

/** 里程碑达成时的冻结券持有量结算：7/14/21 档 +1（封顶 MAX_FREEZES），其他档不变 */
export function grantFreezes(current: number, milestoneDays: number): number {
  const cur = Math.min(MAX_FREEZES, Math.max(0, Math.floor(current) || 0));
  if (!MILESTONE_FREEZE_DAYS.includes(milestoneDays)) return cur;
  return Math.min(MAX_FREEZES, cur + 1);
}

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

/** freeze_dates 列（'2026-09-09,2026-09-15'）→ 集合；只收合法日期，脏数据安全 */
export function parseDayList(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  return new Set(
    String(text)
      .split(',')
      .map(s => s.trim())
      .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s))
  );
}

export function serializeDayList(days: Iterable<string>): string {
  return [...new Set(days)].sort().join(',');
}

/**
 * 连续打卡天数（含冻结券桥接口径）：从今天往前数，遇到漏打的的日子时——
 * · 该日期已在 frozenDates（历史已消费过冻结券）→ 免费续接；
 * · 还有冻结券余量，且更早一天有真实打卡（断点必须直接接回真实记录）→ 消费 1 张桥接，
 *   新消费的日期记入 newFrozenDays 由调用方持久化；
 * · 否则断点成立，只数后半段。
 * freezes=0 时与 calcStreak 完全同口径。列表预览调用方忽略 newFrozenDays（不落库），
 * 打卡事务内调用方才把 newFrozenDays 写回（消费只发生在打卡时刻，不打卡不扣券）。
 */
export function calcStreakWithFreeze(
  checkinDays: string[],
  today: string = todayStr(),
  freezes: number = 0,
  frozenDates: Iterable<string> = [],
): FreezeStreak {
  const set = new Set(checkinDays);
  const frozen = parseDayList([...frozenDates].join(','));
  let budget = Math.max(0, Math.floor(freezes) || 0);
  const newFrozenDays: string[] = [];
  let cursor = set.has(today) ? today : prevDay(today);
  let streak = 0;
  while (true) {
    if (set.has(cursor)) {
      streak++;
      cursor = prevDay(cursor);
      continue;
    }
    if (cursor === today) break; // 今天还没打，没有断点可桥
    const before = prevDay(cursor);
    if (!set.has(before)) break; // 桥接必须直接接回真实打卡日：连漏两天不桥（保护 ≠ 无限豁免）
    if (frozen.has(cursor)) {
      streak++;
      cursor = before;
      continue;
    }
    if (budget > 0) {
      budget--;
      newFrozenDays.push(cursor);
      streak++;
      cursor = before;
      continue;
    }
    break;
  }
  return { streak, newFrozenDays };
}

/**
 * 连续打卡天数：从今天往前数的连续天数（set 去重、无序输入安全）。
 * 今天还没打卡时，若昨天在集合中 streak 仍存活（从昨天起算）——
 * 即「昨天连着打了、今天还没来得及」不会显示断签，打卡后延续。
 */
export function calcStreak(checkinDays: string[], today: string = todayStr()): number {
  return calcStreakWithFreeze(checkinDays, today, 0, []).streak;
}
