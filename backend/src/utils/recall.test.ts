/**
 * 主动回忆单元测试（node:test，运行：npm test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMessageFromToday, pickRecallMemory, buildRecallInstruction, buildLocalRecallReply,
} from './recall';

test('现在的时间戳判定为今天（UTC ISO 刻度比较）', () => {
  assert.equal(isMessageFromToday(new Date().toISOString()), true);
});

test('本地今天凌晨的消息算今天（UTC 日期还是昨天也不能误判）', () => {
  // 本地 09-10 02:00 (CST) = UTC 09-09 18:00 → UTC 日期前缀是 09-09，但属于本地今天
  const now = new Date(2026, 8, 10, 2, 0, 0); // 本地 2026-09-10 02:00
  const utcIso = new Date(Date.UTC(2026, 8, 9, 18, 0, 0)).toISOString();
  assert.equal(isMessageFromToday(utcIso, now), true);
});

test('空/无效时间戳不是今天，昨天整点不算', () => {
  assert.equal(isMessageFromToday(undefined), false);
  assert.equal(isMessageFromToday(''), false);
  const now = new Date(2026, 8, 10, 2, 0, 0);
  assert.equal(isMessageFromToday('2026-09-09T10:00:00.000Z', now), false);
});

test('空记忆不触发回忆', () => {
  assert.equal(pickRecallMemory([]), null);
  assert.equal(buildRecallInstruction('帽子', []), null);
  assert.equal(buildLocalRecallReply('cute', '帽子', []), '');
});

test('挑中的记忆一定来自前 5 条', () => {
  const memories = ['主人叫小明', '主人喜欢猫', '主人讨厌香菜', '主人在学日语', '主人的生日是3月5日', '主人的叮嘱：早睡'];
  for (let i = 0; i < 50; i++) {
    const picked = pickRecallMemory(memories)!;
    assert.ok(memories.slice(0, 5).includes(picked));
  }
});

test('回忆指令包含宠物名与记忆内容', () => {
  const instruction = buildRecallInstruction('帽子', ['主人叫小明'])!;
  assert.ok(instruction.includes('帽子'));
  assert.ok(instruction.includes('主人叫小明'));
  assert.ok(instruction.includes('今日重逢'));
  assert.ok(instruction.includes('只提这一件事'));
});

test('本地兜底回忆回复：每种性格都嵌入记忆且非空', () => {
  for (const personality of ['cute', 'tsundere', 'funny', 'calm', 'cool', 'unknown']) {
    const reply = buildLocalRecallReply(personality, '帽子', ['主人喜欢猫']);
    assert.ok(reply.length > 0);
    assert.ok(reply.includes('主人喜欢猫'));
  }
});

test('未知性格回退 cute 兜底（不抛错）', () => {
  assert.doesNotThrow(() => buildLocalRecallReply('nonexistent', '帽子', ['主人叫小明']));
});
