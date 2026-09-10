/**
 * 帽子AI宠物 - 性格档案（唯一数据源）
 * 孵化选择、首页性格标签、宠物日常台词共用一份定义。
 * 台词是宠物第一人称口吻；idleLineFor 按天轮换（同一天稳定，可预知可测试）。
 */
import type { Personality } from '../store/petStore';

export interface PersonalityProfile {
  key: Personality;
  emoji: string;
  label: string;
  desc: string;
  /** 状态良好时首页的闲聊台词（按天轮换） */
  idleLines: string[];
}

export const PERSONALITY_PROFILES: Record<Personality, PersonalityProfile> = {
  cute: {
    key: 'cute', emoji: '🧸', label: '软萌治愈', desc: '软糯黏人，满嘴撒娇',
    idleLines: [
      '主人主人，今天也要多陪陪我哦～',
      '嘿嘿，我一直在等你回来玩呀',
      '蹭蹭主人，你身上有外面世界的味道',
    ],
  },
  tsundere: {
    key: 'tsundere', emoji: '😤', label: '傲娇毒舌', desc: '嘴上不饶人，心里全是爱',
    idleLines: [
      '哼，我才没有想你，只是刚好坐在门口而已',
      '别摸我头……好吧，就摸一下',
      '笨蛋主人，记得喂我。不是我想吃，是你得尽责',
    ],
  },
  funny: {
    key: 'funny', emoji: '🤪', label: '沙雕活泼', desc: '满脑子骚操作，快乐制造机',
    idleLines: [
      '今天也是帅得没猫样的一天！',
      '报告主人！本喵刚把毛绒球玩出了新高度',
      '我怀疑我有明星天赋，毕竟全场目光都在我身上',
    ],
  },
  calm: {
    key: 'calm', emoji: '🌸', label: '温柔安静', desc: '轻声细语，治愈系陪伴',
    idleLines: [
      '今天的风软软的，和你在一起刚刚好',
      '不着急，慢慢来，我一直都在呢',
      '累了就歇一歇，我陪你晒晒太阳',
    ],
  },
  cool: {
    key: 'cool', emoji: '😎', label: '高冷佛系', desc: '话不多但每句都是金句',
    idleLines: [
      '嗯。你回来了。',
      '……茶不用泡，摸两下就行。',
      '不是想你了。只是这地方只有你能坐。',
    ],
  },
};

export const PERSONALITY_OPTIONS = Object.values(PERSONALITY_PROFILES).map(
  ({ key, emoji, label, desc }) => ({ key, emoji, label, desc })
);

/** 脏数据安全回落 */
export function profileOf(personality: string | null | undefined): PersonalityProfile {
  return PERSONALITY_PROFILES[(personality as Personality) ?? ''] ?? PERSONALITY_PROFILES.cute;
}

/** 一年中的第几天（1 起） */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

/** 首页闲聊台词：同一天稳定、跨天轮换 */
export function idleLineFor(personality: string | null | undefined, date: Date = new Date()): string {
  const lines = profileOf(personality).idleLines;
  return lines[dayOfYear(date) % lines.length];
}
