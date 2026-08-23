/**
 * 帽子AI宠物 - 认证路由
 * 注册、登录、游客快速开始、游客转正
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../db';
import { generateToken, authMiddleware, getCurrentUserId } from '../middleware/auth';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'maozi-pet-dev-secret-change-in-production';

// ============================================================
// 密码工具（轻量哈希，生产环境建议 bcrypt）
// ============================================================

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'maozi-pet-salt').digest('hex');
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 6 && password.length <= 32;
}

// ============================================================
// 游客快速开始
// ============================================================

authRouter.post('/guest', (req: Request, res: Response) => {
  const { nickname = '铲屎官' } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, type, nickname, created_at, last_login_at)
    VALUES (?, 'guest', ?, ?, ?)
  `).run(id, nickname, now, now);

  // 发放初始金币
  db.prepare('UPDATE users SET coins = 100 WHERE id = ?').run(id);

  const token = generateToken({ userId: id, type: 'guest' });

  res.status(201).json({
    user: { id, type: 'guest', nickname, coins: 100, diamonds: 0 },
    token,
    isNewUser: true,
    message: '欢迎来到帽子AI宠物！',
  });
});

// ============================================================
// 注册账号
// ============================================================

authRouter.post('/register', (req: Request, res: Response) => {
  const { email, password, nickname = '铲屎官' } = req.body;

  // 验证
  if (!email || !validateEmail(email)) {
    res.status(400).json({ error: '请输入有效的邮箱地址' });
    return;
  }
  if (!password || !validatePassword(password)) {
    res.status(400).json({ error: '密码需要 6-32 位字符' });
    return;
  }

  // 检查邮箱是否已注册
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: '该邮箱已被注册' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, type, nickname, email, password_hash, created_at, last_login_at)
    VALUES (?, 'registered', ?, ?, ?, ?, ?)
  `).run(id, nickname, email, hashPassword(password), now, now);

  const token = generateToken({ userId: id, type: 'registered' });

  res.status(201).json({
    user: { id, type: 'registered', nickname, email, coins: 100, diamonds: 0 },
    token,
    isNewUser: true,
    message: '注册成功！欢迎加入帽子AI宠物~',
  });
});

// ============================================================
// 登录
// ============================================================

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '请输入邮箱和密码' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  if (user.password_hash !== hashPassword(password)) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  // 更新登录时间
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);

  const token = generateToken({ userId: user.id, type: user.type });

  res.json({
    user: {
      id: user.id,
      type: user.type,
      nickname: user.nickname,
      email: user.email,
      avatarEmoji: user.avatar_emoji,
      bio: user.bio,
      coins: user.coins,
      diamonds: user.diamonds,
      createdAt: user.created_at,
    },
    token,
    isNewUser: false,
    message: `欢迎回来，${user.nickname}！`,
  });
});

// ============================================================
// 游客转正（绑定已有游客数据到新账号）
// ============================================================

authRouter.post('/upgrade', (req: Request, res: Response) => {
  const { guestToken, email, password, nickname } = req.body;

  if (!guestToken) {
    res.status(400).json({ error: '缺少游客凭证' });
    return;
  }
  if (!email || !validateEmail(email)) {
    res.status(400).json({ error: '请输入有效的邮箱地址' });
    return;
  }
  if (!password || !validatePassword(password)) {
    res.status(400).json({ error: '密码需要 6-32 位字符' });
    return;
  }

  // 验证游客 Token
  let guestId: string;
  try {
    const payload = jwt.verify(guestToken, JWT_SECRET);
    guestId = (payload as any).userId;
  } catch {
    res.status(401).json({ error: '游客凭证无效或已过期' });
    return;
  }

  // 检查游客是否存在
  const guest = db.prepare('SELECT * FROM users WHERE id = ? AND type = ?').get(guestId, 'guest') as any;
  if (!guest) {
    res.status(404).json({ error: '游客数据不存在' });
    return;
  }

  // 检查邮箱是否已被占用
  const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, guestId);
  if (emailTaken) {
    res.status(409).json({ error: '该邮箱已被注册' });
    return;
  }

  // 直接升级为正式账号（保留所有数据）
  db.prepare(`
    UPDATE users SET
      type = 'registered',
      email = ?,
      password_hash = ?,
      nickname = ?,
      last_login_at = ?
    WHERE id = ?
  `).run(email, hashPassword(password), nickname || guest.nickname, new Date().toISOString(), guestId);

  const token = generateToken({ userId: guestId, type: 'registered' });
  const upgraded = db.prepare('SELECT * FROM users WHERE id = ?').get(guestId) as any;

  res.json({
    user: {
      id: upgraded.id,
      type: 'registered',
      nickname: upgraded.nickname,
      email: upgraded.email,
      coins: upgraded.coins,
      diamonds: upgraded.diamonds,
    },
    token,
    message: '恭喜成为正式用户！你的宠物和物品都已保留~',
  });
});

// ============================================================
// 获取个人资料
// ============================================================

authRouter.get('/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未授权' });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // 统计
    const petCount = (db.prepare('SELECT COUNT(*) as cnt FROM pets WHERE user_id = ?').get(user.id) as any).cnt;
    const friendCount = (db.prepare('SELECT COUNT(*) as cnt FROM friendships WHERE user_id = ?').get(user.id) as any).cnt;
    const postCount = (db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?').get(user.id) as any).cnt;

    res.json({
      user: {
        id: user.id,
        type: user.type,
        nickname: user.nickname,
        email: user.email,
        avatarEmoji: user.avatar_emoji,
        bio: user.bio,
        coins: user.coins,
        diamonds: user.diamonds,
        privacy: {
          showOnSquare: !!user.privacy_show_on_square,
          allowStrangerInteract: !!user.privacy_allow_stranger,
          hidePetInfo: !!user.privacy_hide_pet_info,
        },
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
      stats: {
        petCount,
        friendCount,
        postCount,
        daysSinceSignup: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      },
    });
  } catch {
    res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

// ============================================================
// 更新个人资料
// ============================================================

authRouter.put('/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未授权' });
    return;
  }

  let userId: string;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Token 无效' });
    return;
  }

  const { nickname, bio, avatarEmoji } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (nickname !== undefined) {
    updates.push('nickname = ?');
    values.push(nickname);
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    values.push(bio);
  }
  if (avatarEmoji !== undefined) {
    updates.push('avatar_emoji = ?');
    values.push(avatarEmoji);
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  res.json({
    user: {
      id: user.id,
      type: user.type,
      nickname: user.nickname,
      email: user.email,
      avatarEmoji: user.avatar_emoji,
      bio: user.bio,
    },
    message: '资料已更新',
  });
});

// ============================================================
// 隐私设置
// ============================================================

authRouter.put('/privacy', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { privacy } = req.body;

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!existing) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  db.prepare(`
    UPDATE users SET
      privacy_show_on_square = ?,
      privacy_allow_stranger = ?,
      privacy_hide_pet_info = ?
    WHERE id = ?
  `).run(
    privacy.showOnSquare !== undefined ? (privacy.showOnSquare ? 1 : 0) : existing.privacy_show_on_square,
    privacy.allowStrangerInteract !== undefined ? (privacy.allowStrangerInteract ? 1 : 0) : existing.privacy_allow_stranger,
    privacy.hidePetInfo !== undefined ? (privacy.hidePetInfo ? 1 : 0) : existing.privacy_hide_pet_info,
    userId,
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  res.json({
    user: {
      id: updated.id,
      nickname: updated.nickname,
      privacy: {
        showOnSquare: !!updated.privacy_show_on_square,
        allowStrangerInteract: !!updated.privacy_allow_stranger,
        hidePetInfo: !!updated.privacy_hide_pet_info,
      },
    },
    message: '隐私设置已更新',
  });
});

// ============================================================
// 云存档同步
// ============================================================

authRouter.post('/sync', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  // 返回该用户的所有宠物数据（客户端对比 lastSyncAt 决定是否需要更新）
  const pets = db.prepare('SELECT * FROM pets WHERE user_id = ?').all(userId);

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    user: {
      id: user.id,
      type: user.type,
      nickname: user.nickname,
      coins: user.coins,
      diamonds: user.diamonds,
    },
    pets,
    message: '云存档同步成功',
  });
});
