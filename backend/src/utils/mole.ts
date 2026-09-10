/**
 * 帽子AI宠物 - 打地鼠（第四款小游戏，Pou 多小游戏矩阵对标）
 * 服务端权威设计：地鼠出现位置序列与每轮时限都由服务器生成/判定，
 * 客户端只上报「敲了哪个洞」，无法伪造反应时间或预知序列。
 * 纯函数（DB 注入式调用方见 routes/pet.ts）。
 */

/** 3×3 洞位数量 */
export const MOLE_HOLES = 9;
/** 每局轮数 */
export const MOLE_ROUNDS = 12;
/** 地鼠停留时长（毫秒，客户端展示窗口） */
export const MOLE_SHOW_MS = 1500;
/** 网络延迟宽限（毫秒，服务端判定窗口 = 展示 + 宽限） */
export const MOLE_GRACE_MS = 900;
/** 每日局数上限 */
export const MOLE_MAX_GAMES_PER_DAY = 5;
/** 满贯金币（与猜数字/翻牌同档，共享每日 200 互动产出预算） */
export const MOLE_COINS_MAX = 20;
/** 金币下限（低压力定位：手慢也有参与奖） */
export const MOLE_COINS_MIN = 6;

export function isValidMoleHole(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= -1 && v < MOLE_HOLES;
}

/** 生成本局地鼠序列：每轮随机洞位，避免连续两轮同洞（至少要移动一下才好玩） */
export function newMoleSequence(rounds: number = MOLE_ROUNDS): number[] {
  const seq: number[] = [];
  for (let i = 0; i < rounds; i++) {
    let hole = Math.floor(Math.random() * MOLE_HOLES);
    if (i > 0 && hole === seq[i - 1]) {
      hole = (hole + 1 + Math.floor(Math.random() * (MOLE_HOLES - 1))) % MOLE_HOLES;
    }
    seq.push(hole);
  }
  return seq;
}

/** 服务端判定窗口内的命中：敲对洞位 且 距本轮开始未超时（负值时钟偏移按 0 处理） */
export function isMoleHit(correctHole: number, whackedHole: number, roundStartedAtMs: number, nowMs: number): boolean {
  if (whackedHole !== correctHole) return false;
  const elapsed = Math.max(0, nowMs - roundStartedAtMs);
  return elapsed <= MOLE_SHOW_MS + MOLE_GRACE_MS;
}

/** 金币曲线：满贯 20，每漏一只 -1，保底 6（与 flip 同思路的反向曲线） */
export function moleCoins(hits: number, rounds: number = MOLE_ROUNDS): number {
  const h = Math.max(0, Math.min(rounds, Math.floor(hits) || 0));
  return Math.max(MOLE_COINS_MIN, MOLE_COINS_MAX - (rounds - h));
}

export function getMoleStartMessage(petName: string): string {
  return `🔨 ${petName}在地洞边跃跃欲试，地鼠冒头就敲，共 ${MOLE_ROUNDS} 轮！`;
}

export function getMoleEndMessage(petName: string, hits: number, rounds: number = MOLE_ROUNDS): number | string {
  if (hits >= rounds) return `🎉 全中！${petName}看呆了：你是地鼠克星吧！`;
  if (hits >= rounds * 0.7) return `🎉 敲中 ${hits}/${rounds}！${petName}拍手叫好~`;
  return `🔨 敲中 ${hits}/${rounds}，${petName}说：地鼠很滑头，再来一局一定更棒！`;
}
