/**
 * 成就徽章单元测试（node:test，运行：npm test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACHIEVEMENT_DEFS, evaluateAchievements, diffNewlyUnlocked,
} from './achievements';

test('空指标：无成就达成', () => {
  assert.deepEqual(evaluateAchievements({}), []);
});

test('互动里程碑逐级解锁', () => {
  assert.deepEqual(evaluateAchievements({ interactions: 1 }), ['first_meet']);
  assert.deepEqual(evaluateAchievements({ interactions: 100 }).sort(), ['companion_100', 'first_meet']);
  assert.ok(evaluateAchievements({ interactions: 300 }).length === 3);
});

test('同一指标多成就同时判定', () => {
  const ids = evaluateAchievements({ chats: 50 });
  assert.ok(ids.includes('chatty_10') && ids.includes('chatty_50'));
});

test('边界值：恰好等于阈值即达成', () => {
  const ids = evaluateAchievements({ rpsWins: 10 });
  assert.ok(ids.includes('rps_10_win'));
  assert.ok(!evaluateAchievements({ rpsWins: 9 }).includes('rps_10_win'));
});

test('缺失指标键按 0 处理（不抛错）', () => {
  assert.doesNotThrow(() => evaluateAchievements({ coins: 500 }));
  assert.deepEqual(evaluateAchievements({ coins: 499 }), []);
});

test('差集：只返回新解锁，历史已有被排除', () => {
  assert.deepEqual(diffNewlyUnlocked(['a', 'b'], []), ['a', 'b']);
  assert.deepEqual(diffNewlyUnlocked(['a', 'b'], ['b']), ['a']);
  assert.deepEqual(diffNewlyUnlocked([], ['a']), []);
  assert.deepEqual(diffNewlyUnlocked(['a'], ['a']), []);
});

test('成就定义完整性：ID 唯一、图标/描述齐全、metric 有对应键规范', () => {
  const ids = new Set(ACHIEVEMENT_DEFS.map(d => d.id));
  assert.equal(ids.size, ACHIEVEMENT_DEFS.length);
  for (const d of ACHIEVEMENT_DEFS) {
    assert.ok(d.title && d.description && d.icon && d.metric);
    assert.ok(d.threshold >= 1);
  }
});
