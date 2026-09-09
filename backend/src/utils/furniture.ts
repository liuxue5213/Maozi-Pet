/**
 * 家具布置载荷校验（纯函数，可单测）
 * user_homes.furniture 存的是家具 id 字符串数组
 */

const MAX_FURNITURE_COUNT = 30;

/** 合法家具 id：1-50 位小写字母/数字/下划线 */
const FURNITURE_ID_RE = /^[a-z0-9_]{1,50}$/;

/**
 * 校验并规范化家具布置载荷：必须是字符串 id 数组、去重、上限 30。
 * 合法返回去重后的 id 数组；非法返回 null（路由层转 400）。
 */
export function sanitizeFurniturePayload(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_FURNITURE_COUNT) return null;
  const ids: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string' || !FURNITURE_ID_RE.test(item)) return null;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids;
}
