/**
 * 帽子AI宠物 - 猜拳小游戏
 * 纯函数：出拳判定 + 按性格生成的宠物反应台词（无 IO，可单测）
 */

export type RpsChoice = 'rock' | 'paper' | 'scissors';
export type RpsResult = 'win' | 'lose' | 'draw';

export const RPS_CHOICES: RpsChoice[] = ['rock', 'paper', 'scissors'];

/** 每日局数上限（赢满 20 局 = 200 金币，与互动共享每日产出预算） */
export const RPS_MAX_PLAYS_PER_DAY = 20;

/** 结果奖励：输了也 +心情（低压力定位，不做惩罚） */
export const RPS_REWARDS: Record<RpsResult, { coins: number; mood: number }> = {
  win: { coins: 10, mood: 10 },
  draw: { coins: 3, mood: 3 },
  lose: { coins: 0, mood: 5 },
};

/** 每局消耗的宠物体力 */
export const RPS_ENERGY_COST = 3;

export function isRpsChoice(v: unknown): v is RpsChoice {
  return typeof v === 'string' && (RPS_CHOICES as string[]).includes(v);
}

export function randomChoice(): RpsChoice {
  return RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)];
}

/** 玩家 vs 宠物 出拳判定 */
export function resolveRps(player: RpsChoice, opponent: RpsChoice): RpsResult {
  if (player === opponent) return 'draw';
  const beats: Record<RpsChoice, RpsChoice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[player] === opponent ? 'win' : 'lose';
}

/** 宠物按性格 + 结果生成的台词（蛋阶段不会说话，由路由层拦截） */
export function getRpsMessage(personality: string, petName: string, result: RpsResult, petChoice: RpsChoice): string {
  const hand: Record<RpsChoice, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

  const lines: Record<string, Record<RpsResult, string[]>> = {
    cute: {
      win: [`${hand[petChoice]} 耶！${petName}赢啦~ 主人好棒陪练！`, `${hand[petChoice]} 嘿嘿，${petName}运气超好喵~`],
      lose: [`${hand[petChoice]} 呜，输给了主人…下次一定赢！`, `${hand[petChoice]} 主人好厉害，${petName}甘拜下风喵~`],
      draw: [`${hand[petChoice]} 平局！我们想到一块去啦`, `${hand[petChoice]} 心有灵犀喵~`],
    },
    tsundere: {
      win: [`${hand[petChoice]} 哼，赢你不过是基本操作！`, `${hand[petChoice]} 才、才不是故意让你看我来赢的呢`],
      lose: [`${hand[petChoice]} 哼…我只是让着主人而已！`, `${hand[petChoice]} 这局不算！重新来！`],
      draw: [`${hand[petChoice]} 平局？算你还有两下子`, `${hand[petChoice]} 别误会，${petName}只是刚好没换招而已`],
    },
    funny: {
      win: [`${hand[petChoice]} 哈哈哈${petName}赢啦，今晚加鸡腿！`, `${hand[petChoice]} 见证奇迹的时刻——是我赢喵！`],
      lose: [`${hand[petChoice]} 主人出老千！（并没有）`, `${hand[petChoice]} 输了输了，${petName}去面壁思过一秒钟`],
      draw: [`${hand[petChoice]} 心电感应！这也太好笑了吧`, `${hand[petChoice]} 平局，裁判喝水时间~`],
    },
    calm: {
      win: [`${hand[petChoice]} 这一局，是${petName}赢了`, `${hand[petChoice]} 胜负乃常事，开心就好`],
      lose: [`${hand[petChoice]} 主人的手势，比风还难猜`, `${hand[petChoice]} 输了也好，主人开心便好`],
      draw: [`${hand[petChoice]} 不分胜负，刚刚好`, `${hand[petChoice]} 平局，像安静的下午`],
    },
    cool: {
      win: [`${hand[petChoice]} 预料之中`, `${hand[petChoice]} 赢了。下一个`],
      lose: [`${hand[petChoice]} ……有进步`, `${hand[petChoice]} 这一局，算你的`],
      draw: [`${hand[petChoice]} 平局，有意思`, `${hand[petChoice]} 想到一起了`],
    },
  };

  const byResult = lines[personality] || lines.cute;
  const list = byResult[result];
  return list[Math.floor(Math.random() * list.length)];
}
