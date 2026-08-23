/**
 * 帽子AI宠物 - JWT 鉴权中间件
 * 保护宠物/聊天接口，防止未授权访问
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'maozi-pet-dev-secret-change-in-production';
const TOKEN_EXPIRY = '30d'; // Token 有效期 30 天

export interface AuthPayload {
  userId: string;
  type: 'guest' | 'registered';
}

// ============================================================
// 生成 Token
// ============================================================

import crypto from 'crypto';

export function generateToken(payload: AuthPayload): string {
  // 加入随机 nonce 防止 Token 冲突
  const token = jwt.sign(
    { ...payload, nonce: crypto.randomBytes(8).toString('hex') },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  // 记录到数据库（支持后续失效）
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    db.prepare(`
      INSERT INTO auth_tokens (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, payload.userId, now.toISOString(), expiresAt.toISOString());
  } catch {
    // Token 冲突时忽略（极低概率）
  }

  return token;
}

// ============================================================
// 验证 Token 中间件
// ============================================================

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未授权，请先登录' });
    return;
  }

  const token = authHeader.slice(7); // 去掉 'Bearer '

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;

    // 额外检查：Token 是否在数据库中（支持主动失效）
    const tokenRecord = db.prepare(`
      SELECT 1 FROM auth_tokens WHERE token = ? AND expires_at > ?
    `).get(token, new Date().toISOString());

    if (!tokenRecord) {
      res.status(401).json({ error: 'Token 已过期或失效' });
      return;
    }

    // 将用户信息附加到请求对象
    (req as any).userId = payload.userId;
    (req as any).userType = payload.type;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token 已过期，请重新登录' });
    } else {
      res.status(401).json({ error: 'Token 无效' });
    }
  }
}

// ============================================================
// 可选鉴权（不强制，但如果有 Token 就解析）
// ============================================================

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
      (req as any).userId = payload.userId;
      (req as any).userType = payload.type;
    } catch {
      // Token 无效但不阻止请求
    }
  }

  next();
}

// ============================================================
// 获取当前用户 ID（配合中间件使用）
// ============================================================

export function getCurrentUserId(req: Request): string {
  return (req as any).userId || 'anonymous';
}
