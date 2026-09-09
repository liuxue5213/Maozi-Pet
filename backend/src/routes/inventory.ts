/**
 * 帽子AI宠物 - 背包 & 家园路由
 * 装扮系统：物品列表、装备/卸下、购买
 * 家园系统：场景切换、布置、图鉴
 */
import { Router, Request, Response } from 'express';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { sanitizeFurniturePayload } from '../utils/furniture';

export const inventoryRouter = Router();

// 装备槽位白名单（与 item_defs.category 对应）
const VALID_SLOTS = ['hat', 'clothing', 'accessory', 'effect', 'skin', 'frame', 'bubble'];

// ============================================================
// 装扮物品
// ============================================================

// 获取所有物品定义（商城用）
inventoryRouter.get('/items', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const items = db.prepare('SELECT * FROM item_defs ORDER BY category, price_coins').all() as any[];

  // 一次性取出用户已拥有/已收集的物品集合（避免逐条查询）
  const ownedSet = new Set(
    (db.prepare('SELECT item_id FROM user_items WHERE user_id = ?').all(userId) as any[]).map(r => r.item_id)
  );
  const collectedSet = new Set(
    (db.prepare('SELECT item_id FROM collection_records WHERE user_id = ?').all(userId) as any[]).map(r => r.item_id)
  );

  // 标记用户是否已拥有
  const result = items.map(item => ({
    ...item,
    owned: ownedSet.has(item.id),
    collected: collectedSet.has(item.id),
  }));

  res.json({
    items: result,
    categories: [
      { id: 'hat', name: '头饰', icon: '🎩' },
      { id: 'clothing', name: '衣服', icon: '👕' },
      { id: 'accessory', name: '配饰', icon: '🎀' },
      { id: 'effect', name: '特效', icon: '✨' },
      { id: 'skin', name: '皮肤', icon: '🐱' },
      { id: 'frame', name: '头像框', icon: '🖼️' },
      { id: 'bubble', name: '气泡', icon: '💬' },
    ],
  });
});

// 购买统一走 POST /api/shop/buy/:itemId（带事务的原子实现），
// 此处不再提供重复的购买端点

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

  if (!VALID_SLOTS.includes(equipSlot)) {
    res.status(400).json({ error: '无效的装备槽位' });
    return;
  }

  // 同槽位替换（事务保证原子性）
  transaction((tx) => {
    tx.prepare('DELETE FROM pet_equips WHERE pet_id = ? AND slot = ?').run(petId, equipSlot);
    tx.prepare('INSERT INTO pet_equips (pet_id, slot, item_id, equipped_at) VALUES (?, ?, ?, ?)').run(petId, equipSlot, itemId, new Date().toISOString());
  });

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

// 切换场景（付费场景只收一次钱，之后可自由切换）
inventoryRouter.post('/home/scene', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { sceneId } = req.body;

  const scene = db.prepare('SELECT * FROM home_scenes WHERE id = ?').get(sceneId) as any;
  if (!scene) {
    res.status(404).json({ error: '场景不存在' });
    return;
  }

  // 事务：扣费 + 记录所有权 + 切换场景（原子操作）
  const now = new Date().toISOString();
  let charged = false;
  try {
    transaction((tx) => {
      const owned = tx.prepare('SELECT 1 FROM user_scene_owns WHERE user_id = ? AND scene_id = ?').get(userId, sceneId);
      const needPay = scene.price_coins > 0 && !scene.is_default && !owned;

      if (needPay) {
        // 条件更新兜底，防止并发扣成负数
        const deduct = tx.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?')
          .run(scene.price_coins, userId, scene.price_coins);
        if (deduct.changes === 0) {
          throw new Error('INSUFFICIENT_COINS');
        }
        tx.prepare('INSERT OR IGNORE INTO user_scene_owns (user_id, scene_id, purchased_at) VALUES (?, ?, ?)').run(userId, sceneId, now);
        charged = true;
      }

      const existing = tx.prepare('SELECT user_id FROM user_homes WHERE user_id = ?').get(userId);
      if (existing) {
        tx.prepare('UPDATE user_homes SET scene_id = ?, updated_at = ? WHERE user_id = ?').run(sceneId, now, userId);
      } else {
        tx.prepare('INSERT INTO user_homes (user_id, scene_id, furniture, updated_at) VALUES (?, ?, ?, ?)').run(userId, sceneId, '[]', now);
      }
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_COINS') {
      res.status(400).json({ error: '金币不足', needCoins: scene.price_coins });
      return;
    }
    throw err;
  }

  res.json({
    message: charged ? `购买并切换到 ${scene.name}！` : `切换到 ${scene.name}！`,
    scene: { id: scene.id, name: scene.name, backgroundColor: scene.background_color, icon: scene.icon },
  });
});

// 更新家具布置
inventoryRouter.post('/home/furniture', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  // 校验载荷：字符串 id 数组/去重/上限 30（utils/furniture.ts，可单测）
  const furniture = sanitizeFurniturePayload(req.body.furniture);
  if (!furniture) {
    res.status(400).json({ error: '无效的家具数据（需要家具 id 数组，最多 30 件）' });
    return;
  }

  // 持有校验：只能摆放自己购买过的家具（防摆放未拥有项）
  const owned = new Set(
    (db.prepare(`
      SELECT ui.item_id FROM user_items ui
      JOIN item_defs ide ON ide.id = ui.item_id AND ide.category = 'furniture'
      WHERE ui.user_id = ?
    `).all(userId) as any[]).map(r => r.item_id),
  );
  if (furniture.some(fid => !owned.has(fid))) {
    res.status(400).json({ error: '包含未拥有的家具，先去商城看看吧' });
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
    { id: 'skin', name: '皮肤', icon: '🐱' },
    { id: 'frame', name: '头像框', icon: '🖼️' },
    { id: 'bubble', name: '气泡', icon: '💬' },
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

// 赠送初始物品（新用户注册时调用；幂等，重复调用只返回本轮新发放的物品）
inventoryRouter.post('/claim-starter', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const starterItems = [
    { id: 'cloth_tshirt', name: 'T恤' },
    { id: 'acc_bow', name: '蝴蝶结' },
    { id: 'effect_heart', name: '爱心气泡' },
  ];
  const now = new Date().toISOString();
  const granted: { id: string; name: string }[] = [];

  transaction((tx) => {
    starterItems.forEach(({ id, name }) => {
      const existing = tx.prepare('SELECT id FROM user_items WHERE user_id = ? AND item_id = ?').get(userId, id);
      if (!existing) {
        tx.prepare('INSERT INTO user_items (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, ?)').run(userId, id, now);
        tx.prepare('INSERT OR IGNORE INTO collection_records (user_id, item_id, collected_at) VALUES (?, ?, ?)').run(userId, id, now);
        granted.push({ id, name });
      }
    });
  });

  res.json({
    message: granted.length > 0 ? '新手礼包已领取！' : '礼包之前已经领过啦',
    granted,
    items: starterItems.map(i => i.id),
  });
});
