/**
 * 帽子AI宠物 - 日期工具
 * 统一"每日"口径：全部使用服务器本地日期（YYYY-MM-DD）
 * 之前 pet/shop 用 UTC、ai 用本地零点，导致每日重置时间不一致
 */

export function todayStr(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** 今天是否是昨天（本地日期口径） */
export function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${yesterday.getFullYear()}-${month}-${day}` === dateStr;
}
