/**
 * 帽子AI宠物 - 成长曲线纯函数
 * 经验升级 + 阶段进化（蛋 → 3 级幼体 → 8 级少年 → 15 级成年）
 * 供互动成长（routes/pet.ts checkGrowth）与习惯里程碑（routes/habits.ts）共用，
 * 保证两条经验来源走同一条升级/进化规则
 */

/** 每级升级所需经验：level * 20 */
export function expToNextLevel(level: number): number {
  return level * 20;
}

/** 等级 → 成长阶段 */
export function stageForLevel(level: number): 'egg' | 'child' | 'teen' | 'adult' {
  if (level >= 15) return 'adult';
  if (level >= 8) return 'teen';
  if (level >= 3) return 'child';
  return 'egg';
}

export interface GrowthInput {
  level: number;
  exp: number;
  stage: string;
}

export interface GrowthResult {
  level: number;
  exp: number;
  stage: string;
  leveledUp: boolean;
  evolved: boolean;
}

/** 加经验并结算升级/进化（可一次跨多级） */
export function applyExp(pet: GrowthInput, gain: number): GrowthResult {
  let exp = pet.exp + gain;
  let level = pet.level;
  let leveledUp = false;

  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    leveledUp = true;
  }

  const stage = stageForLevel(level);
  const evolved = stage !== pet.stage;

  return { level, exp, stage, leveledUp, evolved };
}
