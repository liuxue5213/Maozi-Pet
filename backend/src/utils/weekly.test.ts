/**
 * 每周记忆摘要单元测试（纯函数）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWeekMemories, buildWeeklyShareText, WEEKLY_MAX_ITEMS, WEEKLY_WINDOW_DAYS } from './weekly';

const NOW = new Date('2026-09-10T12:00:00Z');
const day = (offset: number) => new Date(NOW.getTime() - offset * 86400000).toISOString();

test('常量：7 天窗口、最多 5 条', () => {
  assert.equal(WEEKLY_WINDOW_DAYS, 7);
  assert.equal(WEEKLY_MAX_ITEMS, 5);
});

test('只挑最近 7 天内的记忆，更早的被过滤', () => {
  const items = [
    { content: '一个月前的旧事', created_at: day(30) },
    { content: '八天前的旧事', created_at: day(8) },
    { content: '昨天的新事', created_at: day(1) },
    { content: '今天的新事', created_at: day(0) },
  ];
  const picked = pickWeekMemories(items, NOW);
  assert.deepEqual(picked.map(m => m.content), ['昨天的新事', '今天的新事']);
});

test('按时间正序输出（叙事顺序），超过 5 条保留最近的', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ content: `事${i}`, created_at: day(7 - i * 0.5) }));
  const picked = pickWeekMemories(items, NOW);
  assert.equal(picked.length, WEEKLY_MAX_ITEMS);
  const times = picked.map(m => Date.parse(m.created_at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b), '应按时间正序');
  assert.equal(picked[picked.length - 1].content, '事7', '最新一条在最后');
});

test('脏时间戳安全跳过，空列表返回空', () => {
  assert.deepEqual(pickWeekMemories([], NOW), []);
  const items = [{ content: '坏数据', created_at: 'not-a-date' }];
  assert.deepEqual(pickWeekMemories(items, NOW), []);
});

test('分享文案：有记忆时含条目和日期，空时是温和引导', () => {
  const items = [
    { content: '主人喜欢喝咖啡', created_at: day(2) },
    { content: '主人的猫叫团团', created_at: day(1) },
  ];
  const text = buildWeeklyShareText('团子', items, NOW);
  assert.ok(text.includes('团子的本周回忆'));
  assert.ok(text.includes('· 主人喜欢喝咖啡'));
  assert.ok(text.includes('· 主人的猫叫团团'));
  const empty = buildWeeklyShareText('团子', [], NOW);
  assert.ok(empty.includes('还没有新记忆'));
});
