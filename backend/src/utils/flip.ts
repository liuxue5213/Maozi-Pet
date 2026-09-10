/**
 * 帽子AI宠物 - 记忆翻牌小游戏（第三款，Pou 多小游戏矩阵对标）
 * 4 对宠物主题 emoji ×2 洗混扣在桌面，翻到成对即亮起；全部配对成功 = 胜。
 * 纯函数：桌面生成 + 奖励曲线 + 台词（无 IO，可单测）。
 * 设计对齐猜数字（guess.ts）：服务端存桌面防作弊、每日限局、输了/慢了不惩罚。
 */

/** 桌面用的 4 对 emoji（成对出现，位置洗混） */
export const MEMORY_FACES = ['🐾', '🐟', '🧶', '🎈'] as const;

/** 每日局数上限 */
export const MEMORY_MAX_GAMES_PER_DAY = 5;

/** 全配对最少翻牌数 = 4 对 × 2 翻 */
export const MEMORY_FLIPS_MIN = 8;

/** 完成奖励上限（与猜数字同档，共享每日 200 互动产出预算） */
export const MEMORY_WIN_COINS_MAX = 20;

/** 完成奖励下限（翻得再慢也有 10，低压力定位：不惩罚手慢） */
export const MEMORY_WIN_COINS_MIN = 10;

export function isValidFlipIndex(v: unknown, boardSize: number = MEMORY_FACES.length * 2): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < boardSize;
}

/** 生成洗混的桌面：4 种 emoji 各出现 2 次（Fisher-Yates，每次随机） */
export function newBoard(): string[] {
  const board = [...MEMORY_FACES, ...MEMORY_FACES];
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  return board;
}

/** 完成金币曲线：越少翻牌越高（8 翻 = 20，每多 1 翻 -1，18 翻起保底 10） */
export function flipCoins(flips: number): number {
  const clamped = Math.max(MEMORY_FLIPS_MIN, Math.floor(flips) || 0);
  return Math.max(MEMORY_WIN_COINS_MIN, MEMORY_WIN_COINS_MAX - (clamped - MEMORY_FLIPS_MIN));
}

export function getMemoryStartMessage(petName: string): string {
  return `🃏 ${petName}把 8 张卡片扣在桌上，找出 4 对一样的吧！`;
}

export function getMemoryWinMessage(petName: string, flips: number): string {
  if (flips <= MEMORY_FLIPS_MIN + 2) return `🎉 全部配对成功！只翻了 ${flips} 次，${petName}看呆了：主人有超能力喵！`;
  if (flips <= 14) return `🎉 全部配对成功！翻了 ${flips} 次，和${petName}配合默契~`;
  return `🎉 全部配对成功！${petName}说：慢慢来也一样棒，重要的是都找到啦`;
}
