/**
 * 成长曲线单元测试（utils/growth，互动与习惯里程碑共用的升级/进化规则）
 * 运行：npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expToNextLevel, stageForLevel, applyExp } from './growth';
import { MILESTONE_DEFS } from './habits';

test('升级曲线：每级需要 level * 20 经验', () => {
  assert.equal(expToNextLevel(1), 20);
  assert.equal(expToNextLevel(14), 280);
});

test('阶段阈值：蛋 <3 / 幼体 <8 / 少年 <15 / 成年 >=15', () => {
  assert.equal(stageForLevel(1), 'egg');
  assert.equal(stageForLevel(3), 'child');
  assert.equal(stageForLevel(7), 'child');
  assert.equal(stageForLevel(8), 'teen');
  assert.equal(stageForLevel(15), 'adult');
  assert.equal(stageForLevel(20), 'adult');
});

test('加经验：不升级时只累积', () => {
  const r = applyExp({ level: 1, exp: 10, stage: 'egg' }, 5);
  assert.deepEqual(r, { level: 1, exp: 15, stage: 'egg', leveledUp: false, evolved: false });
});

test('加经验：恰好跨过阈值即升级，余数保留', () => {
  const r = applyExp({ level: 1, exp: 15, stage: 'egg' }, 5);
  assert.equal(r.level, 2);
  assert.equal(r.exp, 0);
  assert.ok(r.leveledUp);
  assert.ok(!r.evolved);
});

test('加经验：一次跨多级（大额里程碑经验）', () => {
  // Lv1 exp0 + 200 → 20+40+60+80=200 恰好用完 → Lv5
  const r = applyExp({ level: 1, exp: 0, stage: 'egg' }, 200);
  assert.equal(r.level, 5);
  assert.equal(r.exp, 0);
  assert.ok(r.leveledUp);
});

test('加经验：升级触发阶段进化（蛋→幼体）', () => {
  // Lv2 需 40 经验：exp15 + 25 → Lv3 → child
  const r = applyExp({ level: 2, exp: 15, stage: 'egg' }, 25);
  assert.equal(r.level, 3);
  assert.equal(r.stage, 'child');
  assert.ok(r.leveledUp && r.evolved);
});

test('加经验：少年→成年进化（Lv14→15）', () => {
  const r = applyExp({ level: 14, exp: 275, stage: 'teen' }, 10);
  assert.equal(r.level, 15);
  assert.equal(r.stage, 'adult');
  assert.ok(r.evolved);
});

test('里程碑经验总量对成长节奏的占比合理（≤ 成年总需求的 25%/习惯）', () => {
  const totalMilestoneExp = MILESTONE_DEFS.reduce((s, m) => s + m.exp, 0);
  // 成年（Lv15）总需求 = 20*(1+...+14) = 2100
  assert.ok(totalMilestoneExp <= 2100 * 0.25, `里程碑总经验 ${totalMilestoneExp} 过高`);
});
