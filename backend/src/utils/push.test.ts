/**
 * 推送免打扰时段单元测试
 * 覆盖：同日窗口 / 跨零点窗口 / 边界时刻 / 非法输入 / 起止相同
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { isWithinQuietHours, parseQuietTime } from './push';

// 用 UTC 时刻构造本地时间会受时区影响，这里直接用本地 Date 构造
const at = (h: number, m: number) => new Date(2026, 8, 10, h, m); // 本地 2026-09-10

test('同日窗口 13:00-15:00：窗口内命中，窗口外不命中', () => {
  assert.strictEqual(isWithinQuietHours(at(14, 0), '13:00', '15:00'), true);
  assert.strictEqual(isWithinQuietHours(at(13, 0), '13:00', '15:00'), true); // 起点含
  assert.strictEqual(isWithinQuietHours(at(15, 0), '13:00', '15:00'), false); // 终点不含
  assert.strictEqual(isWithinQuietHours(at(12, 59), '13:00', '15:00'), false);
});

test('跨零点窗口 22:00-08:00：夜间命中，白天不命中', () => {
  assert.strictEqual(isWithinQuietHours(at(23, 30), '22:00', '08:00'), true);
  assert.strictEqual(isWithinQuietHours(at(3, 0), '22:00', '08:00'), true);
  assert.strictEqual(isWithinQuietHours(at(7, 59), '22:00', '08:00'), true);
  assert.strictEqual(isWithinQuietHours(at(8, 0), '22:00', '08:00'), false);
  assert.strictEqual(isWithinQuietHours(at(12, 0), '22:00', '08:00'), false);
});

test('非法输入一律不启用', () => {
  assert.strictEqual(isWithinQuietHours(at(14, 0), null, null), false);
  assert.strictEqual(isWithinQuietHours(at(14, 0), '13:00', null), false);
  assert.strictEqual(isWithinQuietHours(at(14, 0), '25:00', '15:00'), false);
  assert.strictEqual(isWithinQuietHours(at(14, 0), '13:60', '15:00'), false);
  assert.strictEqual(isWithinQuietHours(at(14, 0), '1300', '15:00'), false);
  assert.strictEqual(isWithinQuietHours(at(14, 0), 13 as any, 15 as any), false);
});

test('起止相同视为未启用（避免全天静音误设）', () => {
  assert.strictEqual(isWithinQuietHours(at(14, 0), '14:00', '14:00'), false);
});

test('parseQuietTime：合法 HH:MM 原样返回，其余 null', () => {
  assert.strictEqual(parseQuietTime('22:00'), '22:00');
  assert.strictEqual(parseQuietTime('08:05'), '08:05');
  assert.strictEqual(parseQuietTime('8:00'), null);
  assert.strictEqual(parseQuietTime('24:00'), null);
  assert.strictEqual(parseQuietTime(undefined), null);
  assert.strictEqual(parseQuietTime(null), null);
});

// === Round 19：习惯打卡提醒 ===
import { isHabitRemindWindow, pickHabitReminder, habitReminderCopy, HABIT_REMIND_START_HOUR, HABIT_REMIND_END_HOUR } from './push';

test('习惯提醒窗口：18:00 含、22:00 不含', () => {
  assert.strictEqual(isHabitRemindWindow(at(18, 0)), true);
  assert.strictEqual(isHabitRemindWindow(at(17, 59)), false);
  assert.strictEqual(isHabitRemindWindow(at(21, 59)), true);
  assert.strictEqual(isHabitRemindWindow(at(22, 0)), false);
  assert.strictEqual(isHabitRemindWindow(at(8, 0)), false);
  assert.strictEqual(HABIT_REMIND_START_HOUR, 18);
  assert.strictEqual(HABIT_REMIND_END_HOUR, 22);
});

test('pickHabitReminder：已打卡/零 streak 的习惯不提醒', () => {
  assert.strictEqual(pickHabitReminder([
    { id: 'a', name: '喝水', streak: 3, checkedToday: true },
    { id: 'b', name: '新习惯', streak: 0, checkedToday: false },
  ]), null);
});

test('pickHabitReminder：多个候选挑 streak 最高的', () => {
  const pick = pickHabitReminder([
    { id: 'a', name: '喝水', streak: 3, checkedToday: false },
    { id: 'b', name: '跑步', streak: 7, checkedToday: false },
    { id: 'c', name: '读书', streak: 1, checkedToday: false },
  ]);
  assert.strictEqual(pick?.id, 'b');
});

test('pickHabitReminder：streak 并列取第一个（稳定）', () => {
  const pick = pickHabitReminder([
    { id: 'x', name: 'A', streak: 5, checkedToday: false },
    { id: 'y', name: 'B', streak: 5, checkedToday: false },
  ]);
  assert.strictEqual(pick?.id, 'x');
});

test('habitReminderCopy：streak≥2 宠物口吻带天数；streak=1 正向开新档；无宠物兜底', () => {
  const a = habitReminderCopy('喝水', 5, '帽子');
  assert.ok(a.title.includes('别断') && a.body.includes('帽子') && a.body.includes('5 天'));
  const b = habitReminderCopy('跑步', 1, '帽子');
  assert.ok(b.title.includes('好头') && !b.body.includes('连续'));
  const c = habitReminderCopy('读书', 9, null);
  assert.ok(!c.body.includes('undefined') && c.body.includes('9 天'));
});
