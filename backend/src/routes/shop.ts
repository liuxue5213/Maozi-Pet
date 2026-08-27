/**
 * 帽子AI宠物 - 商城 & 连续签到路由
 * 只卖颜值 · 不卖数值 · 零压力
 */
import { Router, Request, Response } from 'express';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { todayStr, isYesterday } from '../utils/today';

export const shopRouter = Router();

// ============================================================
// 连续签到配置
// ============================================================

const CHECKIN_REWARDS = [10, 20, 30, 40, 50, 60, 100]; // 7天循环

// ============================================================
// 连续签到
// ============================================================

// 获取签到状态（今天是否已签、连续天数、日历）
shopRouter.get('/checkin', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const today = todayStr();

  // 获取最近签到记录
  const records = db.prepare(`
    SELECT checkin_date, streak_day, reward_coins
    FROM checkin_records
    WHERE user_id = ?
    ORDER BY checkin_date DESC
    LIMIT 7
  `).all(userId) as any[];

  const todayChecked = records.length > 0 && records[0].checkin_date === today;
  // 当前连续天数：今天已签 → 今天的记录；昨天签过 → 昨天的记录（待延续）；否则 0
  const currentStreak = todayChecked
    ? records[0].streak_day
    : (records.length > 0 && isYesterday(records[0].checkin_date) ? records[0].streak_day : 0);

  // 计算明天是第几天
  const nextStreakDay = todayChecked
    ? (currentStreak % 7) + 1
    : (records.length > 0 && isYesterday(records[0].checkin_date) ? currentStreak + 1 : 1);

  // 生成7天日历视图
  const calendar = Array.from({ length: 7 }, (_, i) => {
    const day = nextStreakDay + i - 1;
    const cycleDay = ((day - 1) % 7 + 7) % 7; // 0-6，避免 day=0（完成 7 天周期）时出现负数索引导致 reward 为 undefined
    return {
      day: i + 1,
      reward: CHECKIN_REWARDS[cycleDay],
      isToday: i === 0 && !todayChecked,
      isCompleted: i === 0 && todayChecked,
    };
  });

  res.json({
    todayChecked,
    currentStreak,
    nextReward: CHECKIN_REWARDS[(nextStreakDay - 1) % 7],
    calendar,
  });
});

// 执行签到
shopRouter.post('/checkin', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const today = todayStr();
  const now = new Date().toISOString();

  // 计算连续天数
  const lastRecord = db.prepare(`
    SELECT streak_day, checkin_date FROM checkin_records
    WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1
  `).get(userId) as any;

  let streakDay = 1;
  if (lastRecord && isYesterday(lastRecord.checkin_date)) {
    streakDay = lastRecord.streak_day + 1;
  }

  const cycleDay = (streakDay - 1) % 7; // 0-6
  const reward = CHECKIN_REWARDS[cycleDay];

  // 事务：记录签到 + 发放金币（原子操作；UNIQUE 冲突 = 并发重复签到，回滚后返回 400）
  try {
    transaction((tx) => {
      tx.prepare(`
        INSERT INTO checkin_records (user_id, checkin_date, streak_day, reward_coins, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, today, streakDay, reward, now);

      tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(reward, userId);
    });
  } catch (err: any) {
    if (typeof err.message === 'string' && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: '今天已经签到过了哦~' });
      return;
    }
    throw err;
  }

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any;

  res.json({
    message: `签到成功！获得 🪙 ${reward} 金币`,
    reward,
    streakDay,
    totalCoins: user.coins,
    nextReward: CHECKIN_REWARDS[(streakDay) % 7],
  });
});

// ============================================================
// 商城
// ============================================================

// 获取商城商品（按分类）
shopRouter.get('/items', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const category = req.query.category as string;

  let query = 'SELECT * FROM item_defs WHERE 1=1';
  const params: any[] = [];

  if (category && category !== 'all') {
    query += ' AND shop_category = ?';
    params.push(category);
  }

  query += ' ORDER BY sort_order';

  const items = db.prepare(query).all(...params) as any[];

  // 一次性取出用户已拥有/已收集的物品集合（避免逐条查询）
  const ownedSet = new Set(
    (db.prepare('SELECT item_id FROM user_items WHERE user_id = ?').all(userId) as any[]).map(r => r.item_id)
  );
  const collectedSet = new Set(
    (db.prepare('SELECT item_id FROM collection_records WHERE user_id = ?').all(userId) as any[]).map(r => r.item_id)
  );

  // 标记已拥有
  const result = items.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    shopCategory: item.shop_category,
    icon: item.icon,
    description: item.description,
    priceCoins: item.price_coins,
    rarity: item.rarity,
    isLimited: !!item.is_limited,
    owned: ownedSet.has(item.id),
    collected: collectedSet.has(item.id),
  }));

  // 必须返回映射后的 result（camelCase）：原始 items 是数据库 snake_case 行，
  // 直接返回会导致前端价格/分类筛选/已拥有标记全部失效
  res.json({
    items: result,
    categories: [
      { id: 'all', name: '全部', icon: '🛍️' },
      { id: 'decoration', name: '装扮', icon: '👗' },
      { id: 'effect', name: '特效', icon: '✨' },
      { id: 'skin', name: '皮肤', icon: '🐱' },
      { id: 'frame', name: '头像框', icon: '🖼️' },
      { id: 'bubble', name: '气泡', icon: '💬' },
    ],
  });
});

// 购买商品
shopRouter.post('/buy/:itemId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { itemId } = req.params;

  const item = db.prepare('SELECT * FROM item_defs WHERE id = ?').get(itemId) as any;
  if (!item) {
    res.status(404).json({ error: '商品不存在' });
    return;
  }

  const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any;

  if (user.coins < item.price_coins) {
    res.status(400).json({
      error: '金币不足',
      needCoins: item.price_coins,
      haveCoins: user.coins,
    });
    return;
  }

  const existing = db.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, itemId);

  // 用事务保证：扣币 + 发货 原子操作
  // 扣款用条件更新（coins >= 价格）兜底，防止并发请求把余额刷成负数
  const now = new Date().toISOString();
  try {
    transaction((tx) => {
      const deduct = tx.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?')
        .run(item.price_coins, userId, item.price_coins);
      if (deduct.changes === 0) {
        throw new Error('INSUFFICIENT_COINS');
      }

      if (existing) {
        tx.prepare('UPDATE user_items SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
      } else {
        tx.prepare('INSERT INTO user_items (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)').run(userId, itemId, now);
        tx.prepare('INSERT OR IGNORE INTO collection_records (user_id, item_id, collected_at) VALUES (?, ?, ?)').run(userId, itemId, now);
      }
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_COINS') {
      res.status(400).json({ error: '金币不足', needCoins: item.price_coins });
      return;
    }
    throw err;
  }

  const newBalance = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any).coins;

  res.json({
    message: `🎉 成功购买 ${item.name}！`,
    item: { id: item.id, name: item.name, icon: item.icon, category: item.category },
    coinsLeft: newBalance,
  });
});
