/**
 * 记忆翻牌单元测试（纯函数）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_FACES, MEMORY_MAX_GAMES_PER_DAY, MEMORY_FLIPS_MIN,
  MEMORY_WIN_COINS_MAX, MEMORY_WIN_COINS_MIN,
  newBoard, flipCoins, isValidFlipIndex,
  getMemoryStartMessage, getMemoryWinMessage,
} from './flip';

test('常量：4 对面、日限 5 局、奖励曲线边界', () => {
  assert.equal(MEMORY_FACES.length, 4);
  assert.equal(MEMORY_MAX_GAMES_PER_DAY, 5);
  assert.equal(MEMORY_FLIPS_MIN, 8);
  assert.equal(MEMORY_WIN_COINS_MAX, 20);
  assert.equal(MEMORY_WIN_COINS_MIN, 10);
});

test('newBoard：8 张、4 种面各恰好出现 2 次', () => {
  for (let i = 0; i < 20; i++) {
    const board = newBoard();
    assert.equal(board.length, 8);
    const counts = new Map<string, number>();
    for (const face of board) counts.set(face, (counts.get(face) || 0) + 1);
    assert.equal(counts.size, 4, '应有 4 种面');
    for (const n of counts.values()) assert.equal(n, 2, '每种面恰好 2 张');
  }
});

test('newBoard：多次生成会有不同排列（洗牌生效）', () => {
  const boards = new Set(Array.from({ length: 30 }, () => newBoard().join(',')));
  assert.ok(boards.size > 1, '30 次生成应出现多种排列');
});

test('flipCoins：8 翻满分、每多 1 翻 -1、18 翻起保底 10', () => {
  assert.equal(flipCoins(8), 20);
  assert.equal(flipCoins(9), 19);
  assert.equal(flipCoins(13), 15);
  assert.equal(flipCoins(18), 10);
  assert.equal(flipCoins(30), 10, '超量翻牌保底');
  assert.equal(flipCoins(0), 20, '非法/零值按最少翻牌计');
  assert.equal(flipCoins(Number.NaN), 20);
});

test('isValidFlipIndex：0-7 合法、负数/越界/非整数拒绝', () => {
  assert.equal(isValidFlipIndex(0), true);
  assert.equal(isValidFlipIndex(7), true);
  assert.equal(isValidFlipIndex(-1), false);
  assert.equal(isValidFlipIndex(8), false);
  assert.equal(isValidFlipIndex(1.5), false);
  assert.equal(isValidFlipIndex('3'), false);
  assert.equal(isValidFlipIndex(null), false);
});

test('台词：开局/胜利文案非空且分档', () => {
  assert.ok(getMemoryStartMessage('团子').includes('团子'));
  const fast = getMemoryWinMessage('团子', 8);
  const slow = getMemoryWinMessage('团子', 20);
  assert.ok(fast.includes('8'));
  assert.notEqual(fast, slow, '快慢档文案应不同');
});
