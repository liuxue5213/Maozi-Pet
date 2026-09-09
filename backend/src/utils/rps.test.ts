/**
 * 猜拳小游戏单元测试（node:test，运行：npm test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RPS_CHOICES, RPS_MAX_PLAYS_PER_DAY, RPS_REWARDS, RPS_ENERGY_COST,
  isRpsChoice, randomChoice, resolveRps, getRpsMessage,
} from './rps';

test('出拳合法性校验', () => {
  assert.equal(isRpsChoice('rock'), true);
  assert.equal(isRpsChoice('paper'), true);
  assert.equal(isRpsChoice('scissors'), true);
  assert.equal(isRpsChoice('bomb'), false);
  assert.equal(isRpsChoice(''), false);
  assert.equal(isRpsChoice(null), false);
  assert.equal(isRpsChoice(undefined), false);
});

test('随机出拳始终是合法选项', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(isRpsChoice(randomChoice()));
  }
});

test('石头赢剪刀、输布、平石头', () => {
  assert.equal(resolveRps('rock', 'scissors'), 'win');
  assert.equal(resolveRps('rock', 'paper'), 'lose');
  assert.equal(resolveRps('rock', 'rock'), 'draw');
});

test('剪刀赢布、输石头、平剪刀', () => {
  assert.equal(resolveRps('scissors', 'paper'), 'win');
  assert.equal(resolveRps('scissors', 'rock'), 'lose');
  assert.equal(resolveRps('scissors', 'scissors'), 'draw');
});

test('布赢石头、输剪刀、平布', () => {
  assert.equal(resolveRps('paper', 'rock'), 'win');
  assert.equal(resolveRps('paper', 'scissors'), 'lose');
  assert.equal(resolveRps('paper', 'paper'), 'draw');
});

test('穷举 9 种组合：结果分布为 3胜3负3平', () => {
  const counts = { win: 0, lose: 0, draw: 0 };
  for (const a of RPS_CHOICES) {
    for (const b of RPS_CHOICES) {
      counts[resolveRps(a, b)]++;
    }
  }
  assert.deepEqual(counts, { win: 3, lose: 3, draw: 3 });
});

test('奖励设计符合低压力定位：输了也有心情收益，只有赢才有金币', () => {
  assert.equal(RPS_REWARDS.lose.mood > 0, true);
  assert.equal(RPS_REWARDS.lose.coins, 0);
  assert.equal(RPS_REWARDS.win.coins > RPS_REWARDS.draw.coins, true);
  assert.equal(RPS_REWARDS.win.mood > RPS_REWARDS.lose.mood, true);
  assert.equal(RPS_ENERGY_COST > 0, true);
  assert.equal(RPS_MAX_PLAYS_PER_DAY > 0, true);
});

test('每种性格 × 每种结果都能生成非空台词', () => {
  for (const personality of ['cute', 'tsundere', 'funny', 'calm', 'cool', 'unknown']) {
    for (const result of ['win', 'lose', 'draw'] as const) {
      const msg = getRpsMessage(personality, '帽子', result, 'rock');
      assert.equal(typeof msg, 'string');
      assert.ok(msg.length > 0);
    }
  }
});

test('未知性格回退到 cute 台词（不抛错）', () => {
  assert.doesNotThrow(() => getRpsMessage('nonexistent', '帽子', 'win', 'paper'));
});
