/**
 * 帽子AI宠物 - 猜数字小游戏（第二轮"帽子心里想了一个 1-100 的数"）
 * 纯函数：谜底生成 + 提示判定 + 台词（无 IO，可单测）
 * 设计对齐猜拳（rps.ts）：每局 +心情，赢了 +金币，输了不惩罚
 */

export type GuessHint = 'higher' | 'lower' | 'correct';

export const GUESS_MIN = 1;
export const GUESS_MAX = 100;

/** 每日局数上限（赢一局最多 +20 金币，与互动共享每日产出预算） */
export const GUESS_MAX_GAMES_PER_DAY = 5;

/** 每局最大猜测次数（⌈log2(100)⌉ = 7 次保证二分必胜，手感留有余量） */
export const GUESS_MAX_ATTEMPTS = 7;

/** 结果奖励：输了也 +心情（低压力定位）；更快猜中奖励更高 */
export const GUESS_WIN_COINS_MAX = 20;

export function isGuessNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= GUESS_MIN && v <= GUESS_MAX;
}

export function newSecret(): number {
  return GUESS_MIN + Math.floor(Math.random() * (GUESS_MAX - GUESS_MIN + 1));
}

/** 猜测判定：谜底比猜测「大 / 小 / 正确」 */
export function evaluateGuess(secret: number, guess: number): GuessHint {
  if (guess === secret) return 'correct';
  return guess < secret ? 'higher' : 'lower';
}

/** 赢局金币：用越少次数越高（7 次用满 = 10，1 次猜中 = 20） */
export function guessWinCoins(attemptsUsed: number): number {
  const clamped = Math.max(1, Math.min(GUESS_MAX_ATTEMPTS, attemptsUsed));
  return GUESS_WIN_COINS_MAX - Math.round(((clamped - 1) / (GUESS_MAX_ATTEMPTS - 1)) * 10);
}

/** 猜测提示台词（提示即内容，不做性格分线路，保持轻量） */
export function getGuessHintMessage(hint: Exclude<GuessHint, 'correct'>, petName: string, guess: number): string {
  return hint === 'higher'
    ? `🔼 ${guess} 太小啦，${petName}想的数比这大`
    : `🔽 ${guess} 太大了，${petName}想的数比这小`;
}

export function getGuessWinMessage(petName: string, attemptsUsed: number): string {
  if (attemptsUsed <= 2) return `🎉 一次/两猜就中！${petName}惊呆了：主人会读心术喵！`;
  if (attemptsUsed <= 4) return `🎉 猜对啦！就是 ${attemptsUsed} 次找到的，配合默契~`;
  return `🎉 险险猜中！${petName}差点就要公布答案了`;
}

export function getGuessLoseMessage(petName: string, secret: number): string {
  return `💭 次数用完啦~ ${petName}心里想的是 ${secret}，下次一定中！`;
}
