/**
 * 社区图片上传纯函数测试
 * 运行：npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  imageExtFromMime, validateBase64Image, isValidPostImageUrl, filenameFromPostImageUrl, MAX_UPLOAD_BYTES,
} from './upload';

test('mime 白名单：jpeg/png/webp 映射扩展名，其余拒绝', () => {
  assert.equal(imageExtFromMime('image/jpeg'), 'jpg');
  assert.equal(imageExtFromMime('image/png'), 'png');
  assert.equal(imageExtFromMime('image/webp'), 'webp');
  assert.equal(imageExtFromMime('IMAGE/PNG'), 'png');
  assert.equal(imageExtFromMime('application/zip'), null);
  assert.equal(imageExtFromMime('image/gif'), null);
  assert.equal(imageExtFromMime(123 as any), null);
  assert.equal(imageExtFromMime(null), null);
});

test('base64 校验：合法载荷返回字节数', () => {
  // 1x1 png，67 bytes
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.ok(validateBase64Image(png)! > 0);
  assert.equal(validateBase64Image(''), null);
  assert.equal(validateBase64Image('not base64!!!'), null);
  assert.equal(validateBase64Image(null), null);
  assert.equal(validateBase64Image(123 as any), null);
});

test('base64 校验：超过 700KB 上限拒绝', () => {
  const big = 'A'.repeat(Math.ceil((MAX_UPLOAD_BYTES + 1024) * 4 / 3));
  assert.equal(validateBase64Image(big), null);
  const ok = 'A'.repeat(300);
  assert.ok(validateBase64Image(ok) !== null);
});

test('帖子 imageUrl 白名单：只接受 /uploads/ 下 uuid 文件名', () => {
  assert.ok(isValidPostImageUrl('/uploads/4336397d-b40c-46f8-8b9f-648ac7cb1803.png'));
  assert.ok(isValidPostImageUrl('/uploads/aabbccdd-1122-3344-5566-7788aabbccdd.webp'));
  assert.equal(isValidPostImageUrl('https://evil.com/x.png'), false);
  assert.equal(isValidPostImageUrl('/uploads/../secret.txt'), false);
  assert.equal(isValidPostImageUrl('/uploads/short.png'), false);
  assert.equal(isValidPostImageUrl('/uploads/4336397d-b40c-46f8-8b9f-648ac7cb1803.gif'), false);
  assert.equal(isValidPostImageUrl('/uploads/4336397d-b40c-46f8-8b9f-648ac7cb1803.png/extra'), false);
  assert.equal(isValidPostImageUrl(123 as any), false);
});

test('从合法 imageUrl 提取文件名；非法返回 null', () => {
  assert.equal(filenameFromPostImageUrl('/uploads/4336397d-b40c-46f8-8b9f-648ac7cb1803.png'), '4336397d-b40c-46f8-8b9f-648ac7cb1803.png');
  assert.equal(filenameFromPostImageUrl('https://evil.com/x.png'), null);
});
