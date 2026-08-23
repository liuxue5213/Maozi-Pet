/**
 * 帽子AI宠物 - 背包 & 家园路由
 * 装扮系统：物品列表、装备/卸下、购买
 * 家园系统：场景切换、布置、图鉴
 */
import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';

export const inventoryRouter = Router();

// ============================================================
// 装扮物品
// ============================================================

// 获取所有物品定义（商城用）
inventoryRouter.get('/items', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const items = db.prepare('SELECT * FROM item_defs ORDER BY category, price_coins').all() as any[];

  // 标记用户是否已拥有
  const result = items.map(item => ({
    ...item,
    owned: !!db.prepare('SELECT 1 FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, item.id),
    collected: !!db.prepare('SELECT 1 FROM collection_records WHERE user_id = ? AND item_id = ?').get(userId, item.id),
  }));

  res.json({
    items: result,
    categories: [
      { id: 'hat', name: '头饰', icon: '🎩' },
      { id: 'clothing', name: '衣服', icon: '👕' },
      { id: 'accessory', name: '配饰', icon: '🎀' },
      { id: 'effect', name: '特效', icon: '✨' },
    ],
  });
});

// 购买物品
inventoryRouter.post('/items/:itemId/buy', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { itemId } = req.params;

  const item = db.prepare('SELECT * FROM item_defs WHERE id = ?').get(itemId) as any;
  if (!item) {
    res.status(404).json({ error: '物品不存在' });
    return;
  }

  const user = db.prepare('SELECT coins, diamonds FROM users WHERE id = ?').get(userId) as any;

  // 检查货币
  if (user.coins < item.price_coins) {
    res.status(400).json({ error: '金币不足', needCoins: item.price_coins, haveCoins: user.coins });
    return;
  }

  const existing = db.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, itemId);

  if (existing) {
    // 已拥有，增加数量
    db.prepare('UPDATE user_items SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?').run(userId, itemId);
  } else {
    // 新获得
    db.prepare('INSERT INTO user_items (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)').run(userId, itemId, new Date().toISOString());
    // 图鉴记录
    db.prepare('INSERT OR IGNORE INTO collection_records (user_id, item_id, collected_at) VALUES (?, ?, ?)').run(userId, itemId, new Date().toISOString());
  }

  // 扣金币
  db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(item.price_coins, userId);

  const newBalance = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any).coins;

  res.json({
    message: `成功购买 ${item.name}！`,
    item: { id: item.id, name: item.name, icon: item.icon },
    coinsLeft: newBalance,
  });
});

// 获取用户背包（已拥有物品）
inventoryRouter.get('/backpack', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const items = db.prepare(`
    SELECT ui.*, id.name, id.category, id.icon, id.description, id.rarity, id.price_coins
    FROM user_items ui
    JOIN item_defs id ON ui.item_id = id.id
    WHERE ui.user_id = ?
    ORDER BY id.category, id.price_coins
  `).all(userId) as any[];

  res.json({
    items: items.map(i => ({
      id: i.item_id,
      name: i.name,
      category: i.category,
      icon: i.icon,
      description: i.description,
      rarity: i.rarity,
      quantity: i.quantity,
      priceCoins: i.price_coins,
      acquiredAt: i.acquired_at,
    })),
  });
});

// ============================================================
// 宠物装备
// ============================================================

// 装备物品
inventoryRouter.post('/pets/:petId/equip', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const { itemId, slot } = req.body;

  // 验证宠物归属
  const pet = db.prepare('SELECT id FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
  if (!pet) {
    res.status(403).json({ error: '无效的宠物' });
    return;
  }

  // 验证拥有物品
  const owned = db.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, itemId);
  if (!owned) {
    res.status(403).json({ error: '未拥有该物品' });
    return;
  }

  const item = db.prepare('SELECT * FROM item_defs WHERE id = ?').get(itemId) as any;
  const equipSlot = slot || item.category; // 默认按品类对应槽位

  // 同槽位替换
  db.prepare('DELETE FROM pet_equips WHERE pet_id = ? AND slot = ?').run(petId, equipSlot);
  db.prepare('INSERT INTO pet_equips (pet_id, slot, item_id, equipped_at) VALUES (?, ?, ?, ?)').run(petId, equipSlot, itemId, new Date().toISOString());

  res.json({
    message: `装备 ${item.name} 成功！`,
    slot: equipSlot,
    item: { id: item.id, name: item.name, icon: item.icon },
  });
});

// 卸下物品
inventoryRouter.post('/pets/:petId/unequip', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const { slot } = req.body;

  const pet = db.prepare('SELECT id FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
  if (!pet) {
    res.status(403).json({ error: '无效的宠物' });
    return;
  }

  db.prepare('DELETE FROM pet_equips WHERE pet_id = ? AND slot = ?').run(petId, slot);
  res.json({ message: '卸下成功', slot });
});

// 获取宠物当前装备
inventoryRouter.get('/pets/:petId/equips', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const pet = db.prepare('SELECT id FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
  if (!pet) {
    res.status(403).json({ error: '无效的宠物' });
    return;
  }

  const equips = db.prepare(`
    SELECT pe.slot, pe.item_id, id.name, id.icon, id.category
    FROM pet_equips pe
    JOIN item_defs id ON pe.item_id = id.id
    WHERE pe.pet_id = ?
  `).all(petId) as any[];

  res.json({
    equips: equips.map(e => ({
      slot: e.slot,
      itemId: e.item_id,
      name: e.name,
      icon: e.icon,
      category: e.category,
    })),
  });
});

// ============================================================
// 家园系统
// ============================================================

// 获取所有场景
inventoryRouter.get('/scenes', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const scenes = db.prepare('SELECT * FROM home_scenes ORDER BY is_default DESC, price_coins').all() as any[];

  // 获取用户当前家园
  const home = db.prepare('SELECT * FROM user_homes WHERE user_id = ?').get(userId) as any;

  res.json({
    scenes: scenes.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      backgroundColor: s.background_color,
      icon: s.icon,
      priceCoins: s.price_coins,
      isDefault: !!s.is_default,
    })),
    currentScene: home?.scene_id || 'cozy_room',
    furniture: home ? JSON.parse(home.furniture) : [],
  });
});

// 切换场景
inventoryRouter.post('/home/scene', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { sceneId } = req.body;

  const scene = db.prepare('SELECT * FROM home_scenes WHERE id = ?').get(sceneId) as any;
  if (!scene) {
    res.status(404).json({ error: '场景不存在' });
    return;
  }

  // 付费场景检查金币
  if (scene.price_coins > 0 && !scene.is_default) {
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any;
    if (user.coins < scene.price_coins) {
      res.status(400).json({ error: '金币不足', needCoins: scene.price_coins });
      return;
    }
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(scene.price_coins, userId);
  }

  const existing = db.prepare('SELECT user_id FROM user_homes WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_homes SET scene_id = ?, updated_at = ? WHERE user_id = ?').run(sceneId, new Date().toISOString(), userId);
  } else {
    db.prepare('INSERT INTO user_homes (user_id, scene_id, furniture, updated_at) VALUES (?, ?, ?, ?)').run(userId, sceneId, '[]', new Date().toISOString());
  }

  res.json({
    message: `切换到 ${scene.name}！`,
    scene: { id: scene.id, name: scene.name, backgroundColor: scene.background_color, icon: scene.icon },
  });
});

// 更新家具布置
inventoryRouter.post('/home/furniture', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { furniture } = req.body;

  if (!Array.isArray(furniture)) {
    res.status(400).json({ error: '无效的数据格式' });
    return;
  }

  const existing = db.prepare('SELECT user_id FROM user_homes WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_homes SET furniture = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(furniture), new Date().toISOString(), userId);
  } else {
    db.prepare('INSERT INTO user_homes (user_id, scene_id, furniture, updated_at) VALUES (?, ?, ?, ?)').run(userId, 'cozy_room', JSON.stringify(furniture), new Date().toISOString());
  }

  res.json({ message: '家园布置已保存', furniture });
});

// 获取家园完整信息
inventoryRouter.get('/home', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const home = db.prepare('SELECT * FROM user_homes WHERE user_id = ?').get(userId) as any;
  const scene = home ? db.prepare('SELECT * FROM home_scenes WHERE id = ?').get(home.scene_id) : db.prepare('SELECT * FROM home_scenes WHERE is_default = 1').get();

  res.json({
    scene: scene ? {
      id: (scene as any).id,
      name: (scene as any).name,
      backgroundColor: (scene as any).background_color,
      icon: (scene as any).icon,
    } : null,
    furniture: home ? JSON.parse(home.furniture) : [],
  });
});

// ============================================================
// 图鉴系统
// ============================================================

// 获取图鉴收集进度
inventoryRouter.get('/collection', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const allItems = db.prepare('SELECT * FROM item_defs ORDER BY category').all() as any[];
  const collected = db.prepare('SELECT item_id FROM collection_records WHERE user_id = ?').all(userId) as any[];
  const collectedIds = new Set(collected.map(c => c.item_id));

  const categories = [
    { id: 'hat', name: '头饰', icon: '🎩' },
    { id: 'clothing', name: '衣服', icon: '👕' },
    { id: 'accessory', name: '配饰', icon: '🎀' },
    { id: 'effect', name: '特效', icon: '✨' },
  ];

  const collectionByCategory = categories.map(cat => {
    const items = allItems.filter(i => i.category === cat.id).map(i => ({
      id: i.id,
      name: i.name,
      icon: i.icon,
      description: i.description,
      rarity: i.rarity,
      collected: collectedIds.has(i.id),
    }));
    const collectedCount = items.filter(i => i.collected).length;
    return {
      ...cat,
      items,
      total: items.length,
      collected: collectedCount,
      progress: Math.round((collectedCount / items.length) * 100),
    };
  });

  const totalItems = allItems.length;
  const totalCollected = collectedIds.size;

  res.json({
    overview: {
      total: totalItems,
      collected: totalCollected,
      progress: Math.round((totalCollected / totalItems) * 100),
    },
    categories: collectionByCategory,
  });
});

// 赠送初始物品（新用户注册时调用）
inventoryRouter.post('/claim-starter', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const starterItems = ['cloth_tshirt', 'acc_bow', 'effect_heart'];
  const now = new Date().toISOString();

  starterItems.forEach(itemId => {
    const existing = db.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (!existing) {
      db.prepare('INSERT INTO user_items (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)').run(userId, itemId, now);
      db.prepare('INSERT OR IGNORE INTO collection_records (user_id, item_id, collected_at) VALUES (?, ?, ?)').run(userId, itemId, now);
    }
  });

  res.json({ message: '新手礼包已领取！', items: starterItems });
});
