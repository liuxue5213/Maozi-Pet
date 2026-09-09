/**
 * 每日任务系统单元测试（内存 SQLite，不触碰开发数据库）
 * 运行：npm test
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { TASK_DEFS, bumpTaskProgress, getDailyTasks, claimTask } from './tasks';

let database: DatabaseType;

beforeEach(() => {
  database = new Database(':memory:');
  database.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 100);
    CREATE TABLE task_progress (
      user_id TEXT NOT NULL,
      task_date TEXT NOT NULL,
      task_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, task_date, task_id)
    );
  `);
});

function taskState(taskId: string) {
  return getDailyTasks('u1', database).find(t => t.taskId === taskId)!;
}

test('任务定义共 3 个，日奖励上限 45', () => {
  assert.equal(TASK_DEFS.length, 3);
  assert.equal(TASK_DEFS.reduce((s, t) => s + t.reward, 0), 45);
});

test('getDailyTasks 未有任何进度时返回全部未完成', () => {
  const tasks = getDailyTasks('u1', database);
  assert.equal(tasks.length, 3);
  tasks.forEach(t => {
    assert.equal(t.progress, 0);
    assert.equal(t.done, false);
    assert.equal(t.claimed, false);
  });
});

test('推进进度：feed1 一次即完成', () => {
  bumpTaskProgress('u1', 'feed1', database);
  const t = taskState('feed1');
  assert.equal(t.progress, 1);
  assert.equal(t.done, true);
});

test('进度封顶：interact3 超额推进不超 target', () => {
  for (let i = 0; i < 5; i++) bumpTaskProgress('u1', 'interact3', database);
  assert.equal(taskState('interact3').progress, 3);
});

test('未完成任务领取被拒绝', () => {
  assert.throws(() => claimTask('u1', 'chat1', database), /任务还未完成/);
});

test('无效任务 ID：领取抛错、推进静默', () => {
  assert.throws(() => claimTask('u1', 'hack', database), /任务不存在/);
  assert.doesNotThrow(() => bumpTaskProgress('u1', 'hack', database));
});

test('完成后领取：金币到账、状态更新', () => {
  database.prepare("INSERT INTO users (id, coins) VALUES ('u1', 100)").run();
  for (let i = 0; i < 3; i++) bumpTaskProgress('u1', 'interact3', database);

  const reward = claimTask('u1', 'interact3', database);
  assert.equal(reward, 20);
  assert.equal((database.prepare("SELECT coins FROM users WHERE id = 'u1'").get() as any).coins, 120);

  const t = taskState('interact3');
  assert.equal(t.claimed, true);
  assert.equal(t.done, true);
});

test('重复领取被拒绝（条件更新防并发）', () => {
  database.prepare("INSERT INTO users (id, coins) VALUES ('u1', 100)").run();
  bumpTaskProgress('u1', 'feed1', database);
  claimTask('u1', 'feed1', database);
  assert.throws(() => claimTask('u1', 'feed1', database), /已经领取过/);
  assert.equal((database.prepare("SELECT coins FROM users WHERE id = 'u1'").get() as any).coins, 110);
});

test('用户之间进度互相隔离', () => {
  bumpTaskProgress('u1', 'feed1', database);
  const other = getDailyTasks('u2', database).find(t => t.taskId === 'feed1')!;
  assert.equal(other.progress, 0);
  assert.equal(other.done, false);
});
