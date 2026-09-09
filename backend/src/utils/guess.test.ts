/**
 * 猜数字小游戏单元测试
 * 覆盖：判定三分支 / 谜底范围 / 输入校验 / 金币曲线边界 / 提示与结果文案
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  evaluateGuess, isGuessNumber, newSecret, guessWinCoins,
  getGuessHintMessage, getGuessWinMessage, getGuessLoseMessage,
  GUESS_MAX_ATTEMPTS, GUESS_MIN, GUESS_MAX,
} from './guess';

test('猜测判定：小了提示调高', () => {
  assert.strictEqual(evaluateGuess(50, 30), 'higher');
});

test('猜测判定：大了提示调低', () => {
  assert.strictEqual(evaluateGuess(50, 80), 'lower');
});

test('猜测判定：相等即正确（边界）', () => {
  assert.strictEqual(evaluateGuess(50, 50), 'correct');
  assert.strictEqual(evaluateGuess(GUESS_MIN, GUESS_MIN), 'correct');
  assert.strictEqual(evaluateGuess(GUESS_MAX, GUESS_MAX), 'correct');
});

test('谜底生成：始终在 1-100 范围内（抽样 1000 次）', () => {
  for (let i = 0; i < 1000; i++) {
    const s = newSecret();
    assert.ok(Number.isInteger(s) && s >= GUESS_MIN && s <= GUESS_MAX, `越界谜底: ${s}`);
  }
});

test('输入校验：非整数 / 越界 / 非数字全部拒绝', () => {
  assert.strictEqual(isGuessNumber(50), true);
  assert.strictEqual(isGuessNumber(1), true);
  assert.strictEqual(isGuessNumber(100), true);
  assert.strictEqual(isGuessNumber(0), false);
  assert.strictEqual(isGuessNumber(101), false);
  assert.strictEqual(isGuessNumber(50.5), false);
  assert.strictEqual(isGuessNumber('50'), false);
  assert.strictEqual(isGuessNumber(NaN), false);
  assert.strictEqual(isGuessNumber(null), false);
});

test('赢局金币：一次猜中最高，用满次数最低，不越界', () => {
  assert.strictEqual(guessWinCoins(1), 20);
  assert.strictEqual(guessWinCoins(GUESS_MAX_ATTEMPTS), 10);
  // 非法输入被夹紧，不产生离谱奖励
  assert.strictEqual(guessWinCoins(0), 20);
  assert.strictEqual(guessWinCoins(999), 10);
});

test('金币曲线单调不增：次数越多奖励越少', () => {
  for (let a = 1; a < GUESS_MAX_ATTEMPTS; a++) {
    assert.ok(guessWinCoins(a) >= guessWinCoins(a + 1), `次数 ${a} 的奖励应 ≥ 次数 ${a + 1}`);
  }
});

test('提示文案：包含方向词与猜测数字', () => {
  const up = getGuessHintMessage('higher', '咪咪', 30);
  const down = getGuessHintMessage('lower', '咪咪', 80);
  assert.ok(up.includes('30') && up.includes('咪咪'));
  assert.ok(down.includes('80') && down.includes('咪咪'));
});

test('结果文案：胜局报次数，败局公布谜底', () => {
  assert.ok(getGuessWinMessage('咪咪', 3).includes('3'));
  assert.ok(getGuessLoseMessage('咪咪', 73).includes('73'));
});
