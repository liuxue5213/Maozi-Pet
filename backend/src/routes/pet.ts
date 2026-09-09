/**
 * 帽子AI宠物 - 宠物数据路由（持久化 + 鉴权 + 修复经验值 Bug）
 * 属性管理、成长阶段、云存档同步
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { todayStr } from '../utils/today';
import { bumpTaskProgress } from '../utils/tasks';
import { applySleepRecovery, SLEEP_CONFIG } from '../utils/sleep';
import {
  isRpsChoice, randomChoice, resolveRps, getRpsMessage,
  RPS_MAX_PLAYS_PER_DAY, RPS_REWARDS, RPS_ENERGY_COST,
  RpsResult,
} from '../utils/rps';
import {
  evaluateGuess, getGuessHintMessage, getGuessLoseMessage, getGuessWinMessage,
  guessWinCoins, isGuessNumber, newSecret,
  GUESS_MAX_ATTEMPTS, GUESS_MAX_GAMES_PER_DAY,
} from '../utils/guess';

export const petRouter = Router();

// ============================================================
// 常量配置
// ============================================================

const DECAY_RATES = {
  hunger: 0.5,
  cleanliness: 0.3,
  mood: 0.4,
  energy: 0.4,
  health: 0.1,
};

const DECAY_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

// 每次互动获得的经验值
const EXP_PER_INTERACTION = 5;

// 每次互动获得的金币（按互动类型区分，增加经济产出）
const COIN_REWARDS: Record<string, number> = {
  feed: 5,     // 喂食
  clean: 4,    // 清洁
  play: 8,     // 玩耍（互动性最强，奖励最高）
  comfort: 3,  // 安抚
  pet: 3,      // 摸摸
};

// 每次互动金币上限（防止刷金币）
const MAX_COINS_PER_DAY = 200;

// 每日互动次数上限（防止过度刷金币）
const MAX_INTERACTIONS_PER_DAY = 50;

// 升级曲线：每级需要 level * 20 经验
// （原 level*80 + 成年门槛 Lv.50 需要约 19600 次互动才能退休，实际走不完成长循环）
function expToNextLevel(level: number): number {
  return level * 20;
}

// ============================================================
// 类型
// ============================================================

interface PetStats {
  hunger: number;
  cleanliness: number;
  mood: number;
  energy: number;
  health: number;
}

interface PetData {
  id: string;
  name: string;
  personality: string;
  stage: string;
  level: number;
  exp: number;
  stats: PetStats;
  appearance: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  totalInteractions: number;
  isRetired: boolean;
  isSleeping: boolean;
  sleepStartedAt: string | null;
}

// ============================================================
// 数据库行 ↔ 对象转换
// ============================================================

interface PetRow {
  id: string;
  user_id: string;
  name: string;
  personality: string;
  stage: string;
  level: number;
  exp: number;
  stats_hunger: number;
  stats_cleanliness: number;
  stats_mood: number;
  stats_energy: number;
  stats_health: number;
  appearance: string;
  total_interactions: number;
  is_retired: number;
  is_sleeping: number;
  sleep_started_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPet(row: PetRow): PetData {
  return {
    id: row.id,
    name: row.name,
    personality: row.personality,
    stage: row.stage,
    level: row.level,
    exp: row.exp,
    stats: {
      hunger: row.stats_hunger,
      cleanliness: row.stats_cleanliness,
      mood: row.stats_mood,
      energy: row.stats_energy,
      health: row.stats_health,
    },
    appearance: JSON.parse(row.appearance || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalInteractions: row.total_interactions,
    isRetired: !!row.is_retired,
    isSleeping: !!row.is_sleeping,
    sleepStartedAt: row.sleep_started_at,
  };
}

function petToDb(pet: PetData): Record<string, any> {
  return {
    stats_hunger: Math.round(pet.stats.hunger),
    stats_cleanliness: Math.round(pet.stats.cleanliness),
    stats_mood: Math.round(pet.stats.mood),
    stats_energy: Math.round(pet.stats.energy),
    stats_health: Math.round(pet.stats.health),
  };
}

// ============================================================
// 属性衰减计算
// ============================================================

function applyOfflineDecay(pet: PetData): PetData {
  const now = Date.now();

  // 睡觉中的宠物：按睡觉规则结算（体力恢复 + 低耗衰减），锚点是入睡时刻而非 updated_at
  if (pet.isSleeping && pet.sleepStartedAt) {
    const startedAt = new Date(pet.sleepStartedAt).getTime();
    if (now - startedAt < DECAY_INTERVAL_MS) return pet; // 不足一个结算步长，避免无效写回
    const result = applySleepRecovery(pet.stats, pet.sleepStartedAt, new Date(now).toISOString());
    return { ...pet, stats: result.stats, updatedAt: new Date(now).toISOString() };
  }

  const lastUpdate = new Date(pet.updatedAt).getTime();
  const elapsed = now - lastUpdate;
  const intervals = Math.floor(elapsed / DECAY_INTERVAL_MS);

  if (intervals <= 0) return pet;

  const stats = { ...pet.stats };
  // 属性下限 10（不死亡），已低于下限的保持不变，不会出现负数
  const dec = (value: number, rate: number) => Math.min(value, Math.max(10, value - rate * intervals));

  stats.hunger = dec(stats.hunger, DECAY_RATES.hunger);
  stats.cleanliness = dec(stats.cleanliness, DECAY_RATES.cleanliness);
  stats.mood = dec(stats.mood, DECAY_RATES.mood);
  stats.energy = dec(stats.energy, DECAY_RATES.energy);
  stats.health = dec(stats.health, DECAY_RATES.health);

  return { ...pet, stats, updatedAt: new Date().toISOString() };
}

// ============================================================
// 互动逻辑
// ============================================================

function applyInteraction(pet: PetData, action: string): { pet: PetData; message: string } {
  const stats = { ...pet.stats };
  let message = '';

  switch (action) {
    case 'feed':
      stats.hunger = Math.min(100, stats.hunger + 25);
      stats.energy = Math.min(100, stats.energy + 10);
      stats.mood = Math.min(100, stats.mood + 5);
      message = '好吃！喵~ 肚子饱饱的';
      break;
    case 'clean':
      stats.cleanliness = Math.min(100, stats.cleanliness + 30);
      stats.mood = Math.min(100, stats.mood + 10);
      message = '洗得香香的~ 毛发亮晶晶';
      break;
    case 'play':
      stats.mood = Math.min(100, stats.mood + 20);
      stats.energy = Math.max(10, stats.energy - 15);
      stats.hunger = Math.max(10, stats.hunger - 10);
      message = '玩耍好开心！蹦蹦跳跳~';
      break;
    case 'comfort':
      stats.mood = Math.min(100, stats.mood + 15);
      stats.energy = Math.min(100, stats.energy + 5);
      message = '摸摸头~ 好舒服喵~';
      break;
    case 'pet':
      stats.mood = Math.min(100, stats.mood + 10);
      message = '蹭蹭~ 呼噜呼噜~';
      break;
    default:
      stats.mood = Math.min(100, stats.mood + 3);
      message = '陪伴就是最好的互动~';
  }

  return { pet: { ...pet, stats }, message };
}

// ============================================================
// 成长计算（修复后的经验值逻辑）
// ============================================================

function checkGrowth(pet: PetData): { pet: PetData; leveledUp: boolean; evolved: boolean } {
  let exp = pet.exp + EXP_PER_INTERACTION;
  let level = pet.level;
  let leveledUp = false;
  let evolved = false;
  let stage = pet.stage;

  // 检查是否可以升级
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    leveledUp = true;
  }

  // 阶段进化（等级阈值）：蛋 → 3 级幼体 → 8 级少年 → 15 级成年
  // 按新曲线约需 12 次 / 112 次 / 420 次互动，节奏数天到数周，符合"轻养成"定位
  const newStage = level >= 15 ? 'adult' : level >= 8 ? 'teen' : level >= 3 ? 'child' : 'egg';
  if (newStage !== stage) {
    evolved = true;
    stage = newStage;
  }

  return {
    pet: { ...pet, exp, level, stage },
    leveledUp,
    evolved,
  };
}

// ============================================================
// 路由（全部需要鉴权）
// ============================================================

// 获取当前用户的所有宠物
petRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const rows = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId) as PetRow[];
  const pets = rows.map(row => applyOfflineDecay(rowToPet(row)));
  res.json({ pets });
});

// 创建新宠物
petRouter.post('/create', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { personality = 'cute' } = req.body;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';

  // 验证宠物名字
  if (!name || name.length > 20) {
    res.status(400).json({ error: '宠物名字需要 1-20 个字符' });
    return;
  }

  // 验证 personality 有效性
  const validPersonalities = ['cute', 'tsundere', 'funny', 'calm', 'cool'];
  if (!validPersonalities.includes(personality)) {
    res.status(400).json({ error: '无效的性格类型' });
    return;
  }

  const now = new Date().toISOString();
  const newPet: PetData = {
    id: uuidv4(),
    name,
    personality,
    stage: 'egg',
    level: 1,
    exp: 0,
    stats: { hunger: 100, cleanliness: 100, mood: 100, energy: 100, health: 100 },
    appearance: {},
    createdAt: now,
    updatedAt: now,
    totalInteractions: 0,
    isRetired: false,
    isSleeping: false,
    sleepStartedAt: null,
  };

  db.prepare(`
    INSERT INTO pets (id, user_id, name, personality, stage, level, exp,
      stats_hunger, stats_cleanliness, stats_mood, stats_energy, stats_health,
      appearance, total_interactions, is_retired, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newPet.id, userId, newPet.name, newPet.personality, newPet.stage,
    newPet.level, newPet.exp, newPet.stats.hunger, newPet.stats.cleanliness,
    newPet.stats.mood, newPet.stats.energy, newPet.stats.health,
    '{}', 0, 0, now, now,
  );

  res.status(201).json({ pet: newPet, message: '🎉 新宠物蛋已孵化！' });
});

// 获取单个宠物
petRouter.get('/:petId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }

  const pet = applyOfflineDecay(rowToPet(row));

  // 如果有衰减，写回数据库
  if (pet.updatedAt !== row.updated_at) {
    const updates = petToDb(pet);
    db.prepare(`
      UPDATE pets SET
        stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
        stats_energy = ?, stats_health = ?, updated_at = ?
      WHERE id = ?
    `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
           updates.stats_energy, updates.stats_health, pet.updatedAt, petId);
  }

  res.json({ pet });
});

// 互动操作
petRouter.post('/:petId/interact', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const { action } = req.body;

  const validActions = ['feed', 'clean', 'play', 'comfort', 'pet'];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: '无效的互动类型' });
    return;
  }

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }

  let pet = applyOfflineDecay(rowToPet(row));

  // 睡觉中不能互动（先叫醒）
  if (pet.isSleeping) {
    res.status(400).json({ error: `${pet.name} 睡得正香，先叫醒它吧 🌙` });
    return;
  }

  // 执行互动
  const result = applyInteraction(pet, action);
  pet = result.pet;
  pet.totalInteractions++;

  // 成长计算
  const growth = checkGrowth(pet);
  pet = growth.pet;
  pet.updatedAt = new Date().toISOString();

  // 计算金币奖励（按互动类型区分 + 每日上限防刷）
  // 每日统计的读取放在同步事务内，避免并发请求重复领取
  const today = todayStr();

  // 事务：更新宠物 + 发放金币 + 记录每日互动（原子操作）
  const updates = petToDb(pet);
  let coinReward = 0;
  transaction((tx) => {
    const dailyRecord = tx.prepare('SELECT * FROM daily_interactions WHERE user_id = ? AND interaction_date = ?').get(userId, today) as any;

    const currentCount = dailyRecord?.count || 0;
    const currentCoins = dailyRecord?.coins_earned || 0;

    if (currentCount < MAX_INTERACTIONS_PER_DAY && currentCoins < MAX_COINS_PER_DAY) {
      const reward = COIN_REWARDS[action] || 3;
      const remainingCoins = MAX_COINS_PER_DAY - currentCoins;
      coinReward = Math.min(reward, remainingCoins);
    }

    // 写回宠物数据
    tx.prepare(`
      UPDATE pets SET
        stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
        stats_energy = ?, stats_health = ?, level = ?, exp = ?, stage = ?,
        total_interactions = ?, updated_at = ?
      WHERE id = ?
    `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
           updates.stats_energy, updates.stats_health, pet.level, pet.exp,
           pet.stage, pet.totalInteractions, pet.updatedAt, petId);

    // 发放金币
    if (coinReward > 0) {
      tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinReward, userId);
    }

    // 更新每日互动统计
    if (dailyRecord) {
      tx.prepare('UPDATE daily_interactions SET count = count + 1, coins_earned = coins_earned + ? WHERE id = ?').run(coinReward, dailyRecord.id);
    } else {
      tx.prepare('INSERT INTO daily_interactions (user_id, interaction_date, count, coins_earned) VALUES (?, ?, 1, ?)').run(userId, today, coinReward);
    }
  });

  // 构建返回消息
  let message = result.message;
  if (growth.leveledUp) message += ` ⬆️ 升级到 Lv.${pet.level}！`;
  if (growth.evolved) message += ` 🎉 进化为${pet.stage === 'child' ? '幼体' : pet.stage === 'teen' ? '少年' : '成年'}！`;
  if (coinReward > 0) message += ` 🪙+${coinReward}`;

  // 每日任务进度：任意互动 +1；喂食任务单独计
  bumpTaskProgress(userId, 'interact3');
  if (action === 'feed') bumpTaskProgress(userId, 'feed1');

  const userCoins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins || 0;

  res.json({ pet, message, coinReward, totalCoins: userCoins });
});

// 猜拳小游戏：赢+金币+心情 / 输仍+心情（低压力，不做惩罚）
petRouter.post('/:petId/rps', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const { choice } = req.body;

  if (!isRpsChoice(choice)) {
    res.status(400).json({ error: '无效的出拳，请出 ✊✋✌ 之一' });
    return;
  }

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }
  if (row.is_retired) {
    res.status(400).json({ error: '退休的帽子要安心养老啦' });
    return;
  }
  if (row.stage === 'egg') {
    res.status(400).json({ error: '蛋蛋还不会猜拳，先孵化吧~' });
    return;
  }
  if (row.is_sleeping) {
    res.status(400).json({ error: `${row.name} 睡着啦，别让它梦游猜拳 🌙` });
    return;
  }

  const today = todayStr();

  let pet = applyOfflineDecay(rowToPet(row));
  const petChoice = randomChoice();
  const result = resolveRps(choice, petChoice);
  const rewards = RPS_REWARDS[result];

  // 属性结算：心情必得（输了也正向），体力每局消耗
  const stats = { ...pet.stats };
  stats.mood = Math.min(100, stats.mood + rewards.mood);
  stats.energy = Math.max(10, stats.energy - RPS_ENERGY_COST);
  pet = { ...pet, stats };

  pet.totalInteractions++;
  const growth = checkGrowth(pet);
  pet = growth.pet;
  pet.updatedAt = new Date().toISOString();

  const updates = petToDb(pet);
  let coinReward = 0;
  let capped = false;
  let finalPlayCount = 0;
  transaction((tx) => {
    // 每日局数上限在事务内判定（防并发刷局）
    const capRow = tx.prepare('SELECT play_count FROM rps_daily WHERE user_id = ? AND game_date = ?').get(userId, today) as any;
    if ((capRow?.play_count || 0) >= RPS_MAX_PLAYS_PER_DAY) {
      capped = true;
      return;
    }
    finalPlayCount = (capRow?.play_count || 0) + 1;

    // 金币与日常互动共享每日产出预算（防通胀）
    const dailyRecord = tx.prepare('SELECT * FROM daily_interactions WHERE user_id = ? AND interaction_date = ?').get(userId, today) as any;
    const currentCoins = dailyRecord?.coins_earned || 0;
    if (rewards.coins > 0 && currentCoins < MAX_COINS_PER_DAY) {
      coinReward = Math.min(rewards.coins, MAX_COINS_PER_DAY - currentCoins);
    }

    tx.prepare(`
      UPDATE pets SET
        stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
        stats_energy = ?, stats_health = ?, level = ?, exp = ?, stage = ?,
        total_interactions = ?, updated_at = ?
      WHERE id = ?
    `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
           updates.stats_energy, updates.stats_health, pet.level, pet.exp,
           pet.stage, pet.totalInteractions, pet.updatedAt, petId);

    if (coinReward > 0) {
      tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinReward, userId);
    }

    if (dailyRecord) {
      tx.prepare('UPDATE daily_interactions SET count = count + 1, coins_earned = coins_earned + ? WHERE id = ?').run(coinReward, dailyRecord.id);
    } else {
      tx.prepare('INSERT INTO daily_interactions (user_id, interaction_date, count, coins_earned) VALUES (?, ?, 1, ?)').run(userId, today, coinReward);
    }

    // 猜拳局数/胜次统计（失败静默：统计缺失不应阻断游戏）
    try {
      tx.prepare(`
        INSERT INTO rps_daily (user_id, game_date, play_count, win_count)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, game_date)
        DO UPDATE SET play_count = play_count + 1, win_count = win_count + ?
      `).run(userId, today, result === 'win' ? 1 : 0, result === 'win' ? 1 : 0);
    } catch { /* 统计失败不影响游戏 */ }
  });

  if (capped) {
    res.status(400).json({ error: `帽子今天玩累了，明天再来陪它猜拳吧（每日 ${RPS_MAX_PLAYS_PER_DAY} 局）` });
    return;
  }

  let message = getRpsMessage(row.personality, row.name, result as RpsResult, petChoice);
  if (growth.leveledUp) message += ` ⬆️ 升级到 Lv.${pet.level}！`;
  if (coinReward > 0) message += ` 🪙+${coinReward}`;

  bumpTaskProgress(userId, 'interact3');

  const userCoins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins || 0;

  res.json({
    result,
    petChoice,
    pet,
    message,
    coinReward,
    totalCoins: userCoins,
    playsToday: finalPlayCount,
    playsLeft: RPS_MAX_PLAYS_PER_DAY - finalPlayCount,
  });
});

// 哄睡：进入睡觉状态（睡觉期间体力恢复、消耗减慢）
petRouter.post('/:petId/sleep', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }
  if (row.is_retired) {
    res.status(400).json({ error: '退休的帽子在档案馆里安睡呢' });
    return;
  }
  if (row.stage === 'egg') {
    res.status(400).json({ error: '蛋蛋不需要睡觉，快孵化它吧' });
    return;
  }
  if (row.is_sleeping) {
    res.status(400).json({ error: `${row.name} 已经睡着啦` });
    return;
  }

  // 先结算清醒期衰减，再入睡（避免清醒期消耗被睡觉恢复覆盖）
  const awakePet = applyOfflineDecay(rowToPet(row));
  const now = new Date().toISOString();
  const updates = petToDb(awakePet);

  db.prepare(`
    UPDATE pets SET
      stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
      stats_energy = ?, stats_health = ?, updated_at = ?,
      is_sleeping = 1, sleep_started_at = ?
    WHERE id = ?
  `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
         updates.stats_energy, updates.stats_health, now, now, petId);

  res.json({
    pet: { ...awakePet, isSleeping: true, sleepStartedAt: now },
    message: `🌙 晚安，${row.name}睡着了…（睡觉时体力会慢慢恢复）`,
  });
});

// 叫醒：结算睡觉期间的恢复，返回恢复明细
petRouter.post('/:petId/wake', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }
  if (!row.is_sleeping) {
    res.status(400).json({ error: `${row.name} 醒着呢，不用叫` });
    return;
  }

  const pet = rowToPet(row);
  const result = applySleepRecovery(pet.stats, pet.sleepStartedAt || pet.updatedAt);
  const stats = result.stats;
  // 睡饱心情奖励：一次性 +5（睡觉期间心情冻结，醒时精神好）
  stats.mood = Math.min(100, stats.mood + 5);

  const now = new Date().toISOString();
  const updates = petToDb({ ...pet, stats });
  db.prepare(`
    UPDATE pets SET
      stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
      stats_energy = ?, stats_health = ?, updated_at = ?,
      is_sleeping = 0, sleep_started_at = NULL
    WHERE id = ?
  `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
         updates.stats_energy, updates.stats_health, now, petId);

  const energyRecovered = Math.max(0, Math.round(stats.energy - pet.stats.energy));
  const minutes = result.minutesAsleep;
  const durationText = minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${minutes} 分钟`;
  const message = minutes < 1
    ? `☀️ ${row.name} 揉揉眼睛醒了（才刚睡着呀）`
    : `☀️ ${row.name} 睡了 ${durationText}，精神满满！⚡体力 +${energyRecovered} 😊心情 +5`;

  res.json({
    pet: { ...pet, stats, isSleeping: false, sleepStartedAt: null, updatedAt: now },
    message,
    minutesAsleep: minutes,
    energyRecovered,
  });
});

// ============================================================
// 猜数字小游戏（谜底存服务端防作弊；每局 +心情，赢局 +金币，输了不惩罚）
// ============================================================

// 开新局（有进行中的局则原样续玩，不重复扣每日局数）
petRouter.post('/:petId/guess/start', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }
  if (row.is_retired) {
    res.status(400).json({ error: '退休的帽子要安心养老啦' });
    return;
  }
  if (row.stage === 'egg') {
    res.status(400).json({ error: '蛋蛋还不会想数字，先孵化吧~' });
    return;
  }
  if (row.is_sleeping) {
    res.status(400).json({ error: `${row.name} 睡着啦，梦里也要猜数吗 🌙` });
    return;
  }

  const today = todayStr();

  // 续玩进行中的局
  const active = db.prepare(
    "SELECT id, attempts, max_attempts FROM guess_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).get(userId) as any;
  if (active) {
    res.json({
      sessionId: active.id,
      attemptsUsed: active.attempts,
      attemptsLeft: active.max_attempts - active.attempts,
      maxAttempts: active.max_attempts,
      resumed: true,
      message: '上一局还没猜完，继续！',
    });
    return;
  }

  // 每日局数上限（在事务内判定 + 写入，防并发刷局）
  let capped = false;
  transaction((tx) => {
    const daily = tx.prepare('SELECT game_count FROM guess_daily WHERE user_id = ? AND game_date = ?').get(userId, today) as any;
    if ((daily?.game_count || 0) >= GUESS_MAX_GAMES_PER_DAY) {
      capped = true;
      return;
    }
    tx.prepare(`
      INSERT INTO guess_sessions (user_id, pet_id, secret, attempts, max_attempts, status, created_at, updated_at)
      VALUES (?, ?, ?, 0, ?, 'active', ?, ?)
    `).run(userId, petId, newSecret(), GUESS_MAX_ATTEMPTS, new Date().toISOString(), new Date().toISOString());
  });

  if (capped) {
    res.status(400).json({ error: `帽子今天想累了，明天再来猜吧（每日 ${GUESS_MAX_GAMES_PER_DAY} 局）` });
    return;
  }

  const session = db.prepare(
    "SELECT id, attempts, max_attempts FROM guess_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
  ).get(userId) as any;

  res.json({
    sessionId: session.id,
    attemptsUsed: 0,
    attemptsLeft: session.max_attempts,
    maxAttempts: session.max_attempts,
    resumed: false,
    message: `${row.name} 心里想好了一个 1~100 的数，猜猜看！`,
  });
});

// 猜一次
petRouter.post('/:petId/guess', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const { sessionId, number } = req.body;

  if (!isGuessNumber(number)) {
    res.status(400).json({ error: `请猜一个 ${1}~${100} 的整数` });
    return;
  }

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }
  if (row.is_sleeping) {
    res.status(400).json({ error: `${row.name} 睡着啦，先叫醒它吧 🌙` });
    return;
  }

  const session = db.prepare(
    'SELECT * FROM guess_sessions WHERE id = ? AND user_id = ? AND pet_id = ?'
  ).get(sessionId, userId, petId) as any;
  if (!session) {
    res.status(404).json({ error: '对局不存在，重新开局吧' });
    return;
  }
  if (session.status !== 'active') {
    res.status(400).json({ error: '这一局已经结束了，开新一局吧' });
    return;
  }

  const pet = rowToPet(row);
  const hint = evaluateGuess(session.secret, number);
  const attemptsUsed = session.attempts + 1;
  const won = hint === 'correct';
  const lost = !won && attemptsUsed >= session.max_attempts;

  let coinReward = 0;
  let petOut = pet;

  // 终局（胜/负）才结算属性、金币与每日局数
  if (won || lost) {
    const stats = { ...pet.stats };
    stats.mood = Math.min(100, stats.mood + (won ? 8 : 5));
    if (won) stats.energy = Math.max(10, stats.energy - 5);
    petOut = { ...pet, stats, totalInteractions: pet.totalInteractions + 1 };
    if (won) petOut = checkGrowth(petOut).pet;
    petOut.updatedAt = new Date().toISOString();

    const updates = petToDb(petOut);
    const today = todayStr();
    transaction((tx) => {
      if (won) {
        const dailyRecord = tx.prepare('SELECT coins_earned FROM daily_interactions WHERE user_id = ? AND interaction_date = ?').get(userId, today) as any;
        const currentCoins = dailyRecord?.coins_earned || 0;
        if (currentCoins < MAX_COINS_PER_DAY) {
          coinReward = Math.min(guessWinCoins(attemptsUsed), MAX_COINS_PER_DAY - currentCoins);
        }
      }

      tx.prepare(`
        UPDATE pets SET
          stats_hunger = ?, stats_cleanliness = ?, stats_mood = ?,
          stats_energy = ?, stats_health = ?, level = ?, exp = ?, stage = ?,
          total_interactions = ?, updated_at = ?
        WHERE id = ?
      `).run(updates.stats_hunger, updates.stats_cleanliness, updates.stats_mood,
             updates.stats_energy, updates.stats_health, petOut.level, petOut.exp,
             petOut.stage, petOut.totalInteractions, petOut.updatedAt, petId);

      if (coinReward > 0) {
        tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinReward, userId);
        const dailyRecord = tx.prepare('SELECT id FROM daily_interactions WHERE user_id = ? AND interaction_date = ?').get(userId, today) as any;
        if (dailyRecord) {
          tx.prepare('UPDATE daily_interactions SET coins_earned = coins_earned + ? WHERE id = ?').run(coinReward, dailyRecord.id);
        } else {
          tx.prepare('INSERT INTO daily_interactions (user_id, interaction_date, count, coins_earned) VALUES (?, ?, 0, ?)').run(userId, today, coinReward);
        }
      }

      tx.prepare('UPDATE guess_sessions SET status = ?, attempts = ?, updated_at = ? WHERE id = ?')
        .run(won ? 'won' : 'lost', attemptsUsed, new Date().toISOString(), session.id);

      // 每日局数统计（终局才 +1）
      tx.prepare(`
        INSERT INTO guess_daily (user_id, game_date, game_count, win_count)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, game_date)
        DO UPDATE SET game_count = game_count + 1, win_count = win_count + ?
      `).run(userId, today, won ? 1 : 0, won ? 1 : 0);
    });

    if (won) bumpTaskProgress(userId, 'interact3');

    let message = getGuessWinMessage(row.name, attemptsUsed);
    if (petOut.level > pet.level) message += ` ⬆️ 升级到 Lv.${petOut.level}！`;
    if (coinReward > 0) message += ` 🪙+${coinReward}`;
    const userCoins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins || 0;

    res.json({
      result: 'correct',
      secret: session.secret,
      attemptsUsed,
      pet: petOut,
      coinReward,
      totalCoins: userCoins,
      message,
    });
    return;
  }

  // 未终局：只记次数 + 给方向提示（不消耗属性/金币）
  db.prepare('UPDATE guess_sessions SET attempts = ?, updated_at = ? WHERE id = ?')
    .run(attemptsUsed, new Date().toISOString(), session.id);

  res.json({
    result: hint,
    attemptsUsed,
    attemptsLeft: session.max_attempts - attemptsUsed,
    message: getGuessHintMessage(hint, row.name, number),
  });
});

// 退休宠物
petRouter.post('/:petId/retire', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const row = db.prepare('SELECT * FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as PetRow | undefined;
  if (!row) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }

  if (row.stage !== 'adult') {
    res.status(400).json({ error: '只有成年宠物才能退休' });
    return;
  }

  db.prepare('UPDATE pets SET is_retired = 1, is_sleeping = 0, sleep_started_at = NULL, updated_at = ? WHERE id = ?').run(new Date().toISOString(), petId);

  res.json({
    message: `🌟 ${row.name} 光荣退休，已入驻宠物图鉴档案馆！可以孵化新宠物啦~`,
  });
});
