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

// === Round 18：streak 里程碑 → 宠物成长绑定 ===
import {
  MILESTONE_DEFS, pendingMilestone, nextMilestone, parseAwarded, serializeAwarded,
} from './habits';

test('里程碑定义：4 档 3/7/14/21 天、经验递增、标题图标齐全', () => {
  assert.deepEqual(MILESTONE_DEFS.map(m => m.days), [3, 7, 14, 21]);
  for (let i = 1; i < MILESTONE_DEFS.length; i++) {
    assert.ok(MILESTONE_DEFS[i].exp > MILESTONE_DEFS[i - 1].exp, '经验应递增');
  }
  for (const m of MILESTONE_DEFS) {
    assert.ok(m.title && m.icon && m.exp > 0);
  }
});

test('pendingMilestone：streak 精确到达里程碑天数时触发', () => {
  assert.equal(pendingMilestone(3, new Set())?.days, 3);
  assert.equal(pendingMilestone(7, new Set())?.days, 7);
  assert.equal(pendingMilestone(2, new Set()), null);
});

test('pendingMilestone：>= 语义——跳过发放日后打卡补发最高未发档', () => {
  // streak=5 时首次查询（如无宠物窗口错过 3 天档）→ 补发 3 天档
  assert.equal(pendingMilestone(5, new Set())?.days, 3);
  // streak=15 且 3/7 已发 → 补发 14 天档
  assert.equal(pendingMilestone(15, new Set([3, 7]))?.days, 14);
});

test('pendingMilestone：已发放的档位不重发（防断签重爬刷经验）', () => {
  assert.equal(pendingMilestone(3, new Set([3])), null);
  assert.equal(pendingMilestone(21, new Set([3, 7, 14, 21])), null);
  // 断签后重爬到 3 天：awarded 含 3 → 不再发
  assert.equal(pendingMilestone(3, new Set([3, 7])), null);
});

test('nextMilestone：下一个未达成档位，全部达成返回 null', () => {
  assert.equal(nextMilestone(0)?.days, 3);
  assert.equal(nextMilestone(3)?.days, 7);
  assert.equal(nextMilestone(20)?.days, 21);
  assert.equal(nextMilestone(21), null);
  assert.equal(nextMilestone(100), null);
});

test('awarded_milestones 序列化往返 + 脏数据安全', () => {
  assert.deepEqual([...parseAwarded('7,3')].sort(), [3, 7]);
  assert.equal(serializeAwarded(new Set([7, 3, 14])), '3,7,14');
  assert.deepEqual([...parseAwarded(null)], []);
  assert.deepEqual([...parseAwarded('')], []);
  assert.deepEqual([...parseAwarded('abc,,3,-2,0')], [3]);
});
