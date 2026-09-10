/**
 * 性格外显单元测试（纯函数）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITY_IDS, normalizePersonality, habitCheer } from './personality';

test('性格 ID 集合：5 型齐全', () => {
  assert.deepEqual([...PERSONALITY_IDS], ['cute', 'tsundere', 'funny', 'calm', 'cool']);
});

test('normalizePersonality：合法值原样返回、脏数据回落 cute', () => {
  assert.equal(normalizePersonality('tsundere'), 'tsundere');
  assert.equal(normalizePersonality('cool'), 'cool');
  assert.equal(normalizePersonality('unknown'), 'cute');
  assert.equal(normalizePersonality(''), 'cute');
  assert.equal(normalizePersonality(null), 'cute');
  assert.equal(normalizePersonality(undefined), 'cute');
  assert.equal(normalizePersonality(123), 'cute');
});

test('habitCheer：5 型各自有台词且互不相同', () => {
  const date = new Date(2026, 8, 10);
  const lines = PERSONALITY_IDS.map(p => habitCheer(p, date));
  for (const line of lines) {
    assert.ok(line.length > 0, '台词非空');
  }
  assert.equal(new Set(lines).size, 5, '五种性格台词应互不相同');
});

test('habitCheer：同一天稳定（幂等），跨天可能轮换', () => {
  const d = new Date(2026, 8, 10);
  assert.equal(habitCheer('cute', d), habitCheer('cute', d));
  // 轮换语义：至少在连续几天内出现过不同台词（3 句台词、4 天窗口必出重复外的新句）
  const seen = new Set<string>();
  for (let day = 1; day <= 4; day++) {
    seen.add(habitCheer('funny', new Date(2026, 8, day)));
  }
  assert.ok(seen.size > 1, '跨天应出现不同台词');
});

test('habitCheer：脏性格回落 cute 的台词', () => {
  assert.equal(habitCheer('hacker', new Date(2026, 8, 10)), habitCheer('cute', new Date(2026, 8, 10)));
});
