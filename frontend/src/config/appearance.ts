/**
 * 装扮外观映射：把已装备的 skin/frame/bubble 道具翻译成可见样式
 * （skin → 首页宠物圆盘描边色；frame → 个人头像描边色；bubble → 聊天页宠物气泡配色）
 * 与商城 item_defs 的 id 一一对应，未映射的道具回退到默认色
 */

export const DEFAULT_SKIN_RING = 'transparent';
export const DEFAULT_FRAME_RING = 'transparent';

// 宠物皮肤 → 圆盘描边色
export const SKIN_RING_COLORS: Record<string, string> = {
  skin_tabby: '#F4A460', // 虎斑 · 橘
  skin_siamese: '#A1887F', // 暹罗 · 棕
  skin_calico: '#FFB347', // 三花 · 橘黄
  skin_white: '#E8E8E8', // 纯白 · 浅灰（纯白底上仍可见）
  skin_black: '#4A4A4A', // 黑猫 · 墨色
};

// 头像框 → 头像描边色
export const FRAME_RING_COLORS: Record<string, string> = {
  frame_heart: '#FF6B81',
  frame_star: '#F5C542',
  frame_flame: '#FF6B35',
  frame_diamond: '#5DC2E0',
  frame_rainbow: '#B39DDB',
};

// 聊天气泡 → 宠物消息气泡配色
export interface BubbleStyle {
  backgroundColor: string;
  borderColor: string;
}

export const BUBBLE_STYLES: Record<string, BubbleStyle> = {
  bubble_pink: { backgroundColor: '#FFE3EC', borderColor: '#FFB3C7' },
  bubble_star: { backgroundColor: '#FFF6D9', borderColor: '#F5DE9C' },
  bubble_cat: { backgroundColor: '#F3EBE1', borderColor: '#D9C4AC' },
  bubble_heart: { backgroundColor: '#FFE8E8', borderColor: '#F5B5B5' },
};

// 从已装备列表中取指定槽位的 itemId
export function equippedItemId(equips: { slot: string; itemId: string }[], slot: string): string | null {
  return equips.find(e => e.slot === slot)?.itemId || null;
}
