/**
 * 习惯打卡单元测试（纯函数，不触碰数据库）
 * 运行：npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HABITS, CHECK_MOOD, CHECK_COINS, calcStreak, prevDay } from './habits';

test('常量：上限 3 个习惯、打卡奖励 心情5/金币2', () => {
  assert.equal(MAX_HABITS, 3);
  assert.equal(CHECK_MOOD, 5);
  assert.equal(CHECK_COINS, 2);
});

test('空记录 streak=0', () => {
  assert.equal(calcStreak([], '2026-09-10'), 0);
});

test('只打了今天 streak=1', () => {
  assert.equal(calcStreak(['2026-09-10'], '2026-09-10'), 1);
});

test('今天+昨天连续 streak=2', () => {
  assert.equal(calcStreak(['2026-09-09', '2026-09-10'], '2026-09-10'), 2);
});

test('只打了昨天（今天未打）streak 存活=1，不误报断签', () => {
  assert.equal(calcStreak(['2026-09-09'], '2026-09-10'), 1);
});

test('前天断签（昨天没打、今天也没打）streak=0', () => {
  assert.equal(calcStreak(['2026-09-08'], '2026-09-10'), 0);
});

test('7 天全连 streak=7', () => {
  const days = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
  assert.equal(calcStreak(days, '2026-09-10'), 7);
});

test('中间断一天只数后半段', () => {
  const days = ['2026-09-06', '2026-09-07', '2026-09-09', '2026-09-10'];
  assert.equal(calcStreak(days, '2026-09-10'), 2);
});

test('跨月连续（8-31 → 9-01）', () => {
  assert.equal(calcStreak(['2026-08-31', '2026-09-01'], '2026-09-01'), 2);
  assert.equal(prevDay('2026-09-01'), '2026-08-31');
});

test('跨年连续（12-31 → 1-01）', () => {
  assert.equal(prevDay('2027-01-01'), '2026-12-31');
  assert.equal(calcStreak(['2026-12-31', '2027-01-01'], '2027-01-01'), 2);
});

test('重复与乱序输入安全（Set 去重）', () => {
  const days = ['2026-09-10', '2026-09-10', '2026-09-09', '2026-09-08'];
  assert.equal(calcStreak(days, '2026-09-10'), 3);
});

test('未来日期不算入 streak', () => {
  assert.equal(calcStreak(['2026-09-11', '2026-09-10'], '2026-09-10'), 1);
});
