/**
 * 打地鼠纯函数测试
 * 运行：npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOLE_HOLES, MOLE_ROUNDS, MOLE_SHOW_MS, MOLE_GRACE_MS, MOLE_MAX_GAMES_PER_DAY,
  isValidMoleHole, newMoleSequence, isMoleHit, moleCoins, getMoleEndMessage,
} from './mole';

test('常量：9 洞 12 轮，窗口 1500+900ms，每日 5 局', () => {
  assert.equal(MOLE_HOLES, 9);
  assert.equal(MOLE_ROUNDS, 12);
  assert.equal(MOLE_SHOW_MS, 1500);
  assert.equal(MOLE_GRACE_MS, 900);
  assert.equal(MOLE_MAX_GAMES_PER_DAY, 5);
});

test('洞位校验：0~8 合法，-1（超时未敲）合法，9/小数/非数字拒绝', () => {
  assert.ok(isValidMoleHole(0) && isValidMoleHole(8) && isValidMoleHole(-1));
  assert.ok(!isValidMoleHole(9));
  assert.ok(!isValidMoleHole(1.5));
  assert.ok(!isValidMoleHole('3' as any));
  assert.ok(!isValidMoleHole(null));
});

test('序列：12 轮都在洞位范围内且不连续同洞', () => {
  for (let t = 0; t < 20; t++) {
    const seq = newMoleSequence();
    assert.equal(seq.length, MOLE_ROUNDS);
    seq.forEach(h => assert.ok(h >= 0 && h < MOLE_HOLES));
    for (let i = 1; i < seq.length; i++) {
      assert.notEqual(seq[i], seq[i - 1], `第 ${i} 轮与前一轮同洞`);
    }
  }
});

test('命中判定：敲对洞位且在窗口内', () => {
  const t0 = 1_000_000;
  assert.ok(isMoleHit(5, 5, t0, t0 + MOLE_SHOW_MS + MOLE_GRACE_MS));
  assert.ok(!isMoleHit(5, 5, t0, t0 + MOLE_SHOW_MS + MOLE_GRACE_MS + 1));
  assert.ok(!isMoleHit(5, 6, t0, t0 + 10));
  assert.ok(!isMoleHit(5, -1, t0, t0 + 10));
});

test('时钟偏移防御：now 略早于 roundStart（负 elapsed）按 0 处理仍可命中', () => {
  assert.ok(isMoleHit(3, 3, 1_000_000, 999_999));
});

test('金币曲线：满贯 20，每漏一只 -1，保底 6；非法输入安全', () => {
  assert.equal(moleCoins(12), 20);
  assert.equal(moleCoins(8), 16);
  assert.equal(moleCoins(0), 8); // 0 中也有参与奖（20-12=8 > 下限 6）
  assert.equal(moleCoins(15), 20);
  assert.equal(moleCoins(-3), 8); // 负数钳到 0
  assert.equal(moleCoins(NaN), 8); // NaN 归零
});
