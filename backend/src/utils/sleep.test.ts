/**
 * 睡觉作息系统单元测试
 * 覆盖：零时长无变化 / 体力恢复与封顶 / 低耗衰减与下限 / 心情冻结 / 长时间睡眠 / 时钟注入
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { applySleepRecovery, SLEEP_CONFIG, SleepStats } from './sleep';

const BASE: SleepStats = {
  hunger: 80,
  cleanliness: 70,
  mood: 55,
  energy: 30,
  health: 90,
};

// 2026-09-10T20:00:00Z 为基准入睡时刻
const T0 = '2026-09-10T20:00:00.000Z';
const plusMinutes = (m: number) => new Date(new Date(T0).getTime() + m * 60000).toISOString();

test('睡觉不足一个结算步长：属性无变化，但时长照实返回', () => {
  const r = applySleepRecovery(BASE, T0, plusMinutes(5));
  assert.deepStrictEqual(r.stats, BASE);
  assert.strictEqual(r.minutesAsleep, 5);
});

test('恰好 0 分钟：完全无变化', () => {
  const r = applySleepRecovery(BASE, T0, T0);
  assert.deepStrictEqual(r.stats, BASE);
  assert.strictEqual(r.minutesAsleep, 0);
});

test('睡 60 分钟：体力 +18，心情/健康冻结', () => {
  const r = applySleepRecovery(BASE, T0, plusMinutes(60));
  assert.strictEqual(r.stats.energy, 30 + SLEEP_CONFIG.energyPerInterval * 6);
  assert.strictEqual(r.stats.mood, BASE.mood);
  assert.strictEqual(r.stats.health, BASE.health);
  assert.strictEqual(r.minutesAsleep, 60);
});

test('消耗类属性低耗衰减：速率 = 清醒速率 × 0.25', () => {
  const r = applySleepRecovery(BASE, T0, plusMinutes(60));
  const hungerDrop = SLEEP_CONFIG.awakeDecay.hunger * SLEEP_CONFIG.consumptionFactor * 6; // 0.75
  const cleanDrop = SLEEP_CONFIG.awakeDecay.cleanliness * SLEEP_CONFIG.consumptionFactor * 6; // 0.45
  assert.ok(Math.abs(r.stats.hunger - (80 - hungerDrop)) < 1e-9);
  assert.ok(Math.abs(r.stats.cleanliness - (70 - cleanDrop)) < 1e-9);
});

test('睡一整晚 8 小时：体力回满封顶 100，饥饿/清洁不跌破下限 10', () => {
  const tired: SleepStats = { hunger: 15, cleanliness: 4, mood: 40, energy: 8, health: 90 };
  const r = applySleepRecovery(tired, T0, plusMinutes(8 * 60));
  assert.strictEqual(r.stats.energy, 100);
  assert.strictEqual(r.stats.hunger, SLEEP_CONFIG.statFloor);
  assert.strictEqual(r.stats.cleanliness, SLEEP_CONFIG.statFloor);
});

test('体力接近满值：只补到 100 不溢出', () => {
  const nearFull: SleepStats = { ...BASE, energy: 95 };
  const r = applySleepRecovery(nearFull, T0, plusMinutes(30)); // 3 步 = +9 > 5 缺口
  assert.strictEqual(r.stats.energy, 100);
});

test('已低于下限的属性：睡觉期间不再往下扣', () => {
  const low: SleepStats = { ...BASE, hunger: 10, cleanliness: 5 };
  const r = applySleepRecovery(low, T0, plusMinutes(120));
  assert.strictEqual(r.stats.hunger, 10);
  assert.strictEqual(r.stats.cleanliness, 10);
});

test('不修改入参对象（纯函数）', () => {
  const snapshot = { ...BASE };
  applySleepRecovery(BASE, T0, plusMinutes(120));
  assert.deepStrictEqual(BASE, snapshot);
});

test('入睡时刻在未来（脏数据）：按 0 处理不崩溃', () => {
  const r = applySleepRecovery(BASE, plusMinutes(60), T0);
  assert.deepStrictEqual(r.stats, BASE);
  assert.strictEqual(r.minutesAsleep, 0);
});
