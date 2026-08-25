/**
 * 帽子AI宠物 - 宠物数据路由（持久化 + 鉴权 + 修复经验值 Bug）
 * 属性管理、成长阶段、云存档同步
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { todayStr } from '../utils/today';

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

// 升级曲线：每级需要 level * 80 经验（比之前的 100 更平滑）
function expToNextLevel(level: number): number {
  return level * 80;
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

  // 阶段进化（等级阈值）
  const newStage = level >= 50 ? 'adult' : level >= 25 ? 'teen' : level >= 10 ? 'child' : 'egg';
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

  const userCoins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins || 0;

  res.json({ pet, message, coinReward, totalCoins: userCoins });
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

  db.prepare('UPDATE pets SET is_retired = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), petId);

  res.json({
    message: `🌟 ${row.name} 光荣退休，已入驻宠物图鉴档案馆！可以孵化新宠物啦~`,
  });
});
