/**
 * 记忆提取单元测试（node:test，运行：npm test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts } from './memory';

test('提取主人名字（我叫X）', () => {
  assert.deepEqual(extractFacts('我叫小明'), ['主人叫小明']);
});

test('提取主人名字（我的名字叫X / 叫我X）', () => {
  assert.deepEqual(extractFacts('我的名字叫小红'), ['主人叫小红']);
  assert.deepEqual(extractFacts('叫我阿蛋'), ['主人叫阿蛋']);
});

test('提取喜好与厌恶', () => {
  assert.deepEqual(extractFacts('我喜欢猫'), ['主人喜欢猫']);
  assert.deepEqual(extractFacts('我讨厌下雨天'), ['主人讨厌下雨天']);
  assert.deepEqual(extractFacts('我不喜欢香菜'), ['主人讨厌香菜']);
});

test('提取生日', () => {
  assert.deepEqual(extractFacts('我的生日是3月5日'), ['主人的生日是3月5日']);
});

test('提取叮嘱', () => {
  assert.deepEqual(extractFacts('记住：每天早点睡'), ['主人的叮嘱：每天早点睡']);
});

test('提取正在做的事', () => {
  assert.deepEqual(extractFacts('我在学习日语'), ['主人在学习日语']);
});

test('一条消息提取多条事实', () => {
  assert.deepEqual(extractFacts('我叫小明，我喜欢猫'), ['主人叫小明', '主人喜欢猫']);
});

test('普通聊天不产生记忆', () => {
  assert.deepEqual(extractFacts('今天天气真不错啊'), []);
  assert.deepEqual(extractFacts(''), []);
});

test('超长消息只处理前 500 字（500 字之后的事实被截断）', () => {
  const long = `${'啊'.repeat(500)}记住：喝水`;
  assert.deepEqual(extractFacts(long), []);
});
