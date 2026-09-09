/**
 * 家具布置载荷校验单元测试（运行：npm test）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFurniturePayload } from './furniture';

test('合法载荷：返回去重后的 id 数组', () => {
  assert.deepEqual(
    sanitizeFurniturePayload(['fur_sofa', 'fur_plant', 'fur_sofa']),
    ['fur_sofa', 'fur_plant'],
  );
});

test('空数组合法（全部收起）', () => {
  assert.deepEqual(sanitizeFurniturePayload([]), []);
});

test('非数组拒绝', () => {
  assert.equal(sanitizeFurniturePayload('fur_sofa'), null);
  assert.equal(sanitizeFurniturePayload({ id: 'fur_sofa' }), null);
  assert.equal(sanitizeFurniturePayload(null), null);
});

test('元素不是字符串拒绝', () => {
  assert.equal(sanitizeFurniturePayload([1, 2]), null);
  assert.equal(sanitizeFurniturePayload([{ id: 'fur_sofa' }]), null);
});

test('非法 id 字符拒绝（防任意 JSON 注入）', () => {
  assert.equal(sanitizeFurniturePayload(['<script>']), null);
  assert.equal(sanitizeFurniturePayload(['a'.repeat(51)]), null);
  assert.equal(sanitizeFurniturePayload(['FUR_SOFA']), null);
});

test('超过 30 件拒绝', () => {
  const many = Array.from({ length: 31 }, (_, i) => `fur_${i}`);
  assert.equal(sanitizeFurniturePayload(many), null);
  const ok = Array.from({ length: 30 }, (_, i) => `fur_${i}`);
  assert.equal(sanitizeFurniturePayload(ok)?.length, 30);
});
