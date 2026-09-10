/**
 * 帽子AI宠物 - 性格外显纯函数
 * 5 型性格此前只在 RPS 台词/海报语录/AI prompt 里起作用，外显弱（QQ宠物 AI 版四型灵魂人格
 * 的对照：人格一致性是养成感的核心）。本模块把性格带进日常反馈文案：打卡鼓励语按性格分型，
 * 同一天内稳定、跨天轮换（确定性的 day-of-year 轮换，可单测）。
 */

export const PERSONALITY_IDS = ['cute', 'tsundere', 'funny', 'calm', 'cool'] as const;
export type PersonalityId = (typeof PERSONALITY_IDS)[number];

const DEFAULT_PERSONALITY: PersonalityId = 'cute';

/** 脏数据安全：未知性格回落 cute（与 AI/RPS 的 fallback 行为一致） */
export function normalizePersonality(personality: unknown): PersonalityId {
  return PERSONALITY_IDS.includes(personality as PersonalityId) ? (personality as PersonalityId) : DEFAULT_PERSONALITY;
}

/** 打卡鼓励语（宠物口吻，第一人称）。同一性格多备几句按天轮换，避免天天同一句 */
const HABIT_CHEERS: Record<PersonalityId, string[]> = {
  cute: [
    '「主人最棒了！抱抱 (づ￣3￣)づ」',
    '「嘿嘿，我就知道主人说到做到～」',
    '「今天也乖乖打卡了，奖励我摸摸头！」',
  ],
  tsundere: [
    '「哼、不就是打卡嘛……勉强夸你一下好了」',
    '「才不是为你高兴，只是惯例感叹一下」',
    '「笨蛋主人，明天也要来，不许偷懒」',
  ],
  funny: [
    '「哇！鼓掌撒花！本喵给你转体三周半！」',
    '「打卡达人就是你了！快夸我识货」',
    '「这波操作我给满分，多一分怕你骄傲」',
  ],
  calm: [
    '「慢慢来，我陪着你呢。」',
    '「又平稳地度过一天，真好。」',
    '「今天也一起加油了，辛苦啦。」',
  ],
  cool: [
    '「不错。……只有这次这么说。」',
    '「嗯。继续保持。」',
    '「还行。反正我会看着你的。」',
  ],
};

/** 一年中的第几天（1 起），轮换用 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

/**
 * 打卡成功后的性格鼓励语：同一天稳定、跨天轮换、未知性格回落 cute。
 * date 注入参数供测试。
 */
export function habitCheer(personality: unknown, date: Date = new Date()): string {
  const id = normalizePersonality(personality);
  const lines = HABIT_CHEERS[id];
  return lines[dayOfYear(date) % lines.length];
}
