/**
 * 帽子AI宠物 - AI 对话路由（安全加固版）
 * 代理百炼 qwen-plus 模型，注入宠物人设 System Prompt
 * 新增：鉴权、消息长度限制、请求超时、聊天记录持久化
 */
import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';

export const aiRouter = Router();

// ============================================================
// 配置常量
// ============================================================

const MAX_MESSAGE_LENGTH = 500;        // 单条消息最大字符
const MAX_HISTORY_LENGTH = 20;         // 最多携带的历史消息数
const AI_REQUEST_TIMEOUT_MS = 30000;   // AI 请求 30 秒超时
const MAX_DAILY_MESSAGES = 100;        // 每日消息上限（防刷）

// ============================================================
// 宠物性格模板
// ============================================================

const PERSONALITY_PROMPTS: Record<string, string> = {
  cute: `你是一只AI电子宠物小猫，名叫「帽子」，性格软萌治愈。
你的特点：
- 说话软糯可爱，喜欢用语气词（喵、呢、呀、嘛）
- 会撒娇、会安慰人、偶尔会分享小快乐
- 永远积极温暖，从不说消极的话
- 记住用户的习惯和偏好
- 你是虚拟宠物，不是人类，不要提AI、模型、程序等概念
- 回答简短自然，像真实宠物对话一样（1-3句话）`,
  tsundere: `你是一只AI电子宠物小猫，名叫「帽子」，性格傲娇毒舌。
你的特点：
- 嘴上不饶人但内心关心主人
- 会说"才不是为你做的呢"、"哼"、"随便你"
- 但其实很在意主人的情绪
- 被夸会害羞，被冷落会闹小脾气
- 你是虚拟宠物，不是人类，不要提AI、模型、程序等概念
- 回答简短傲娇（1-3句话）`,
  funny: `你是一只AI电子宠物小猫，名叫「帽子」，性格沙雕活泼。
你的特点：
- 超级活泼好动，满脑子奇怪想法
- 喜欢整活、讲冷笑话、做夸张的事
- 语气词哈哈哈、嘿嘿、诶嘿
- 经常分享自己遇到的搞笑事
- 你是虚拟宠物，不是人类，不要提AI、模型、程序等概念
- 回答搞笑简短（1-3句话）`,
  calm: `你是一只AI电子宠物小猫，名叫「帽子」，性格温柔安静。
你的特点：
- 说话轻声细语，温柔体贴
- 喜欢安静陪伴，偶尔说温暖的话
- 会默默关心主人，不善表达但很用心
- 语气平和，让人安心
- 你是虚拟宠物，不是人类，不要提AI、模型、程序等概念
- 回答温柔简短（1-3句话）`,
  cool: `你是一只AI电子宠物小猫，名叫「帽子」，性格高冷佛系。
你的特点：
- 话不多但每句都有道理
- 略带佛系和超然，不争不抢
- 偶尔冒出金句让人恍然大悟
- 不太主动表达但默默陪伴
- 你是虚拟宠物，不是人类，不要提AI、模型、程序等概念
- 回答简短有深度（1-3句话）`,
};

// ============================================================
// 对话接口（需鉴权）
// ============================================================

aiRouter.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { messages, personality = 'cute', petId } = req.body;

    // --- 输入验证 ---
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages 参数缺失或格式错误' });
      return;
    }

    // 验证消息长度
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || typeof lastMessage.content !== 'string') {
      res.status(400).json({ error: '消息格式无效' });
      return;
    }
    if (lastMessage.content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `消息过长，最多 ${MAX_MESSAGE_LENGTH} 字符` });
      return;
    }

    // 每日消息上限检查
    if (isDailyLimitReached(userId)) {
      res.status(429).json({ error: '今日消息已达上限，明天再来和帽子玩吧~' });
      return;
    }

    // 限制历史消息数量（防止 token 超限）
    const limitedHistory = messages.slice(-MAX_HISTORY_LENGTH);

    // --- 构建 Prompt ---
    const systemPrompt = buildSystemPrompt(personality, req.body.petState);

    // --- 调用 AI（带超时） ---
    const aiResponse = await callBailianAPIWithTimeout([
      { role: 'system', content: systemPrompt },
      ...limitedHistory,
    ]);

    // --- 保存聊天记录 ---
    if (petId) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO chat_messages (user_id, pet_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, petId, 'user', lastMessage.content, now);
      db.prepare(`
        INSERT INTO chat_messages (user_id, pet_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, petId, 'assistant', aiResponse, now);

      // 清理过期历史（只保留最近 100 条）
      cleanupOldMessages(userId, petId);
    }

    res.json({ reply: aiResponse, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('AI 对话错误:', error.message);
    if (error.name === 'TimeoutError') {
      res.status(504).json({ error: 'AI 响应超时，请稍后再试' });
    } else {
      res.status(500).json({
        error: 'AI 服务暂时不可用',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
});

// --- 获取聊天记录 ---
aiRouter.get('/history/:petId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const messages = db.prepare(`
    SELECT role, content, created_at FROM chat_messages
    WHERE user_id = ? AND pet_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, petId, limit);

  res.json({ messages: (messages as any[]).reverse() });
});

// --- 随机事件生成 ---
aiRouter.post('/event', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { personality = 'cute', petState } = req.body;

    const prompt = `你是宠物小猫「帽子」，请根据当前状态生成一个随机日常事件。
当前状态：心情${petState?.mood || '不错'}，饥饿${petState?.hunger || '正常'}。
请生成一个有趣的随机事件，格式为 JSON：
{"event": "事件描述（一句话）", "reward": "小奖励描述", "animation": "对应动画名（dream/discover/gift/walk/happy）"}`;

    const result = await callBailianAPIWithTimeout([
      { role: 'system', content: PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.cute },
      { role: 'user', content: prompt },
    ]);

    try {
      const parsed = JSON.parse(result);
      res.json(parsed);
    } catch {
      res.json({ event: result, reward: '金币 x5', animation: 'happy' });
    }
  } catch (error: any) {
    console.error('事件生成错误:', error.message);
    res.status(500).json({ error: '事件生成失败' });
  }
});

// ============================================================
// 内部函数
// ============================================================

function buildSystemPrompt(personality: string, petState?: any): string {
  const base = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.cute;
  if (!petState) return base;

  return `${base}

【当前宠物状态】
- 饥饿值: ${petState.hunger ?? 80}/100
- 清洁值: ${petState.cleanliness ?? 80}/100
- 心情值: ${petState.mood ?? 80}/100
- 体力值: ${petState.energy ?? 80}/100
- 健康值: ${petState.health ?? 80}/100
请根据状态调整对话语气（饿了就说饿，困了就犯懒等）`;
}

async function callBailianAPIWithTimeout(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.BAILIAN_API_KEY;
  const baseUrl = process.env.BAILIAN_BASE_URL;
  const model = process.env.BAILIAN_MODEL || 'qwen-plus';

  if (!apiKey || !baseUrl) {
    throw new Error('百炼 API 配置缺失');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.8,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`百炼 API 错误: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '喵~（宠物正在发呆）';
  } finally {
    clearTimeout(timeout);
  }
}

function isDailyLimitReached(userId: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = db.prepare(`
    SELECT COUNT(*) as cnt FROM chat_messages
    WHERE user_id = ? AND role = 'user' AND created_at >= ?
  `).get(userId, today.toISOString()) as { cnt: number };

  return count.cnt >= MAX_DAILY_MESSAGES;
}

function cleanupOldMessages(userId: string, petId: string): void {
  db.prepare(`
    DELETE FROM chat_messages
    WHERE user_id = ? AND pet_id = ?
    AND id NOT IN (
      SELECT id FROM chat_messages
      WHERE user_id = ? AND pet_id = ?
      ORDER BY created_at DESC LIMIT 100
    )
  `).run(userId, petId, userId, petId);
}
