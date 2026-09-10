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

// === Round 23：streak 冻结券（Duolingo streak freeze 对标） ===
import {
  MAX_FREEZES, MILESTONE_FREEZE_DAYS, calcStreakWithFreeze, grantFreezes,
  parseDayList, serializeDayList,
} from './habits';

test('冻结券常量：上限 2 张、奖励档为 7/14/21 天', () => {
  assert.equal(MAX_FREEZES, 2);
  assert.deepEqual(MILESTONE_FREEZE_DAYS, [7, 14, 21]);
});

test('无断点时冻结券口径与 calcStreak 一致、零消费', () => {
  const days = ['2026-09-08', '2026-09-09', '2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 1, []);
  assert.equal(r.streak, 3);
  assert.deepEqual(r.newFrozenDays, []);
});

test('昨天漏打 1 天：有券自动桥接 streak 不断、记录新消费', () => {
  // 8 号打了、9 号漏了、10 号回来打卡：8+桥接9+10 = 3
  const days = ['2026-09-08', '2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 1, []);
  assert.equal(r.streak, 3);
  assert.deepEqual(r.newFrozenDays, ['2026-09-09']);
});

test('昨天漏打但没券：只数今天，不桥接', () => {
  const days = ['2026-09-08', '2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 0, []);
  assert.equal(r.streak, 1);
  assert.deepEqual(r.newFrozenDays, []);
});

test('连漏两天不桥接（保护 ≠ 无限豁免），有 2 张券也不桥', () => {
  const days = ['2026-09-07', '2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 2, []);
  assert.equal(r.streak, 1);
  assert.deepEqual(r.newFrozenDays, []);
});

test('今天没打时预览桥接：昨天断点被券保护，streak 仍显示存活', () => {
  // 8 号打了、9 号漏了、今天 10 号还没打：预览 streak=2（8 号+桥接 9 号）且列出待消费断点
  const days = ['2026-09-08'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 1, []);
  assert.equal(r.streak, 2);
  assert.deepEqual(r.newFrozenDays, ['2026-09-09']);
});

test('历史已消费的冻结日免费续接，不再重复扣券', () => {
  // 8 号打了、9 号漏打（已消费过券）、10 号打卡后再查询：8+桥接9+10 = 3
  const days = ['2026-09-08', '2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 0, ['2026-09-09']);
  assert.equal(r.streak, 3);
  assert.deepEqual(r.newFrozenDays, []);
});

test('冻结桥必须直接接回真实打卡日：断点前没记录则不桥', () => {
  // 只有今天打了，昨天和前天都空：没得接，不消费券
  const days = ['2026-09-10'];
  const r = calcStreakWithFreeze(days, '2026-09-10', 1, []);
  assert.equal(r.streak, 1);
  assert.deepEqual(r.newFrozenDays, []);
});

test('冻结券跨月/跨年桥接（prevDay 口径复用）', () => {
  const r = calcStreakWithFreeze(['2026-08-31', '2026-09-02'], '2026-09-02', 1, []);
  assert.equal(r.streak, 3);
  assert.deepEqual(r.newFrozenDays, ['2026-09-01']);
});

test('grantFreezes：7/14/21 档 +1 且封顶 2 张，3 档不给、非法输入安全', () => {
  assert.equal(grantFreezes(0, 7), 1);
  assert.equal(grantFreezes(1, 14), 2);
  assert.equal(grantFreezes(2, 21), 2, '已满 2 张不再累加');
  assert.equal(grantFreezes(0, 3), 0, '3 天档不发券');
  assert.equal(grantFreezes(1, 3), 1);
  assert.equal(grantFreezes(-5, 7), 1, '负数当前值先归零再发');
  assert.equal(grantFreezes(Number.NaN, 7), 1);
});

test('freeze_dates 序列化往返 + 脏数据过滤', () => {
  assert.deepEqual([...parseDayList('2026-09-10,2026-09-09')].sort(), ['2026-09-09', '2026-09-10']);
  assert.equal(serializeDayList(['2026-09-10', '2026-09-09', '2026-09-10']), '2026-09-09,2026-09-10');
  assert.deepEqual([...parseDayList(null)], []);
  assert.deepEqual([...parseDayList('abc,2026-9-9,2026-09-09,')], ['2026-09-09']);
});
