/**
 * 睡觉作息系统（纯函数，可单测）
 * 睡觉 = 体力恢复窗口：energy 缓慢回满，消耗类属性降为 1/4 衰减，心情冻结
 * 唤醒时的心情奖励由路由层结算（+5），此处只管睡期间的属性变化
 */

export interface SleepStats {
  hunger: number;
  cleanliness: number;
  mood: number;
  energy: number;
  health: number;
}

export const SLEEP_CONFIG = {
  /** 结算步长（分钟）：与清醒态衰减的 10 分钟档对齐 */
  intervalMinutes: 10,
  /** 每步恢复的体力 */
  energyPerInterval: 3,
  /** 睡觉期间饥饿/清洁的衰减系数（清醒态速率 × 该系数） */
  consumptionFactor: 0.25,
  /** 清醒态衰减速率（与 pet.ts DECAY_RATES 保持一致，用于低耗换算） */
  awakeDecay: { hunger: 0.5, cleanliness: 0.3 },
  /** 属性下限：不死亡 */
  statFloor: 10,
} as const;

const INTERVAL_MS = SLEEP_CONFIG.intervalMinutes * 60 * 1000;

/**
 * 按入睡时刻结算睡期间的属性变化
 * @param stats 入睡时（或上次结算时）的属性
 * @param startedAtISO 入睡时刻
 * @param nowISO 当前时刻（默认取系统时间，测试可注入）
 * @returns 结算后的属性 + 实际生效的睡眠时长（分钟，向上取整到分钟便于展示）
 */
export function applySleepRecovery(
  stats: SleepStats,
  startedAtISO: string,
  nowISO: string = new Date().toISOString(),
): { stats: SleepStats; minutesAsleep: number } {
  const startedAt = new Date(startedAtISO).getTime();
  const now = new Date(nowISO).getTime();
  const intervals = Math.floor(Math.max(0, now - startedAt) / INTERVAL_MS);
  const minutesAsleep = Math.max(0, Math.round((now - startedAt) / 60000));

  if (intervals <= 0) {
    return { stats: { ...stats }, minutesAsleep };
  }

  const floor = (v: number) => Math.max(SLEEP_CONFIG.statFloor, v);

  return {
    stats: {
      // 体力：睡够就回满（封顶 100）
      energy: Math.min(100, stats.energy + SLEEP_CONFIG.energyPerInterval * intervals),
      // 消耗类：低耗缓慢下降（睡觉也会肚子饿）
      hunger: floor(stats.hunger - SLEEP_CONFIG.awakeDecay.hunger * SLEEP_CONFIG.consumptionFactor * intervals),
      cleanliness: floor(stats.cleanliness - SLEEP_CONFIG.awakeDecay.cleanliness * SLEEP_CONFIG.consumptionFactor * intervals),
      // 睡着没有情绪波动，冻结
      mood: stats.mood,
      health: stats.health,
    },
    minutesAsleep,
  };
}
