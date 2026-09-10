/**
 * 帽子AI宠物 - 每周记忆摘要（QQ宠物「沉淀独家养成记忆」/ 记忆周报分享对标）
 * 从全量记忆里挑最近 7 天（滚动窗口，保证周一早上也有内容），
 * 生成宠物口吻的分享文案——记忆必须让用户「看见 + 带走」才产生情感依赖。
 * 纯函数（DB 注入式调用方见 routes/ai.ts）。
 */

export interface WeeklyMemory {
  content: string;
  created_at: string;
}

export const WEEKLY_WINDOW_DAYS = 7;
export const WEEKLY_MAX_ITEMS = 5;

/**
 * 挑选本周记忆：时间戳比较（created_at 为 UTC ISO，避免时区换算陷阱），
 * 按时间正序（周报是「这周发生了什么」的叙事顺序），超过 max 时保留最近的。
 */
export function pickWeekMemories(
  memories: WeeklyMemory[],
  now: Date = new Date(),
  max: number = WEEKLY_MAX_ITEMS,
): WeeklyMemory[] {
  const cutoff = now.getTime() - WEEKLY_WINDOW_DAYS * 86400000;
  const inWindow = memories
    .filter(m => {
      const t = Date.parse(m.created_at);
      return !Number.isNaN(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return inWindow.slice(-Math.max(1, max));
}

/** MM-DD 本地口径标签 */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 宠物口吻的周报分享文案（原生存储/海报外的第三类传播物料） */
export function buildWeeklyShareText(petName: string, items: WeeklyMemory[], now: Date = new Date()): string {
  const start = new Date(now.getTime() - WEEKLY_WINDOW_DAYS * 86400000);
  const label = `${dayLabel(start.toISOString())} ~ ${dayLabel(now.toISOString())}`;
  if (items.length === 0) {
    return `📒 ${petName}的本周回忆（${label}）：\n这周还没有新记忆，多和我聊聊呀，说「我叫...」「我喜欢...」，我都记在心里~`;
  }
  const lines = items.map(m => `· ${m.content}（${dayLabel(m.created_at)} 记下）`).join('\n');
  return `📒 ${petName}的本周回忆（${label}）：\n${lines}\n——新的一周也请多多指教！`;
}
