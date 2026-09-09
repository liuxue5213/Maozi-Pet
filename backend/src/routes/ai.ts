/**
 * 帽子AI宠物 - AI 对话路由（安全加固版）
 * 代理百炼 qwen-plus 模型，注入宠物人设 System Prompt
 * 新增：鉴权、消息长度限制、请求超时、聊天记录持久化
 */
import { Router, Request, Response } from 'express';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { todayStr } from '../utils/today';
import { extractFacts } from '../utils/memory';

export const aiRouter = Router();

// ============================================================
// 配置常量
// ============================================================

const MAX_MESSAGE_LENGTH = 500;        // 单条消息最大字符
const MAX_HISTORY_LENGTH = 20;         // 最多携带的历史消息数
const AI_REQUEST_TIMEOUT_MS = 30000;   // AI 请求 30 秒超时
const MAX_DAILY_MESSAGES = 100;        // 每日消息上限（防刷）
const MAX_COINS_PER_DAY = 200;         // 每日金币产出上限（与互动共享，见 routes/pet.ts）

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

    // 每日消息上限检查（chat 与 event 共用同一计数，与 petId 无关）
    if (isDailyLimitReached(userId)) {
      res.status(429).json({ error: '今日消息已达上限，明天再来和帽子玩吧~' });
      return;
    }
    incrementDailyChat(userId);

    // 限制历史消息数量 + 只放行 user/assistant 角色
    // （防止客户端注入 role:system 覆盖宠物人设）
    const limitedHistory = messages
      .filter((m: any) =>
        (m?.role === 'user' || m?.role === 'assistant') &&
        typeof m?.content === 'string' && m.content.length > 0)
      .slice(-MAX_HISTORY_LENGTH)
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

    // --- 获取宠物完整信息 ---
    let petInfo: any = null;
    if (petId) {
      const petRow = db.prepare('SELECT id, name, personality, stage, level, total_interactions FROM pets WHERE id = ? AND user_id = ?').get(petId, userId) as any;
      if (petRow) {
        petInfo = {
          name: petRow.name,
          personality: petRow.personality,
          stage: petRow.stage,
          level: petRow.level,
          totalInteractions: petRow.total_interactions,
        };
      }
    }

    // --- 构建 Prompt（注入关于主人的记忆，实现个性化陪伴）---
    const memories = petId ? getMemories(userId, petId, 10) : [];
    const systemPrompt = buildSystemPrompt(personality, req.body.petState, petInfo, memories);

    // --- 调用 AI（带超时），失败时用本地回复兜底 ---
    let aiResponse: string;
    try {
      aiResponse = await callBailianAPIWithTimeout([
        { role: 'system', content: systemPrompt },
        ...limitedHistory,
      ]);
    } catch {
      // AI API 不可用时使用本地兜底回复
      aiResponse = getLocalReply(personality, lastMessage.content, req.body.petState);
    }

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

      // 从用户消息中提取值得记住的事实（静默进行，失败不影响对话）
      extractMemories(userId, petId, lastMessage.content);
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
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);

  const messages = db.prepare(`
    SELECT role, content, created_at FROM chat_messages
    WHERE user_id = ? AND pet_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, petId, limit);

  res.json({ messages: (messages as any[]).reverse() });
});

// --- 查看宠物记得的事 ---
aiRouter.get('/memories/:petId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 50);

  const rows = db.prepare(`
    SELECT id, content, created_at FROM pet_memories
    WHERE user_id = ? AND pet_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, petId, limit);

  res.json({ memories: rows });
});

// --- 遗忘一条记忆 ---
aiRouter.delete('/memories/:petId/:memoryId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId, memoryId } = req.params;
  const id = parseInt(memoryId, 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: '无效的记忆 ID' });
    return;
  }

  const result = db.prepare('DELETE FROM pet_memories WHERE id = ? AND user_id = ? AND pet_id = ?')
    .run(id, userId, petId);
  if (result.changes === 0) {
    res.status(404).json({ error: '记忆不存在' });
    return;
  }
  res.json({ message: '已忘记这件事' });
});

// --- 随机事件生成 ---
aiRouter.post('/event', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { personality = 'cute', petState } = req.body;

    // 事件生成同样计入每日 AI 调用限额（防刷）
    if (isDailyLimitReached(userId)) {
      res.status(429).json({ error: '今日互动已达上限，明天再来和帽子玩吧~' });
      return;
    }
    incrementDailyChat(userId);

    const prompt = `你是宠物小猫「帽子」，请根据当前状态生成一个随机日常事件。
当前状态：心情${petState?.mood || '不错'}，饥饿${petState?.hunger || '正常'}。
请生成一个有趣的随机事件，格式为 JSON：
{"event": "事件描述（一句话）", "reward": "小奖励描述", "animation": "对应动画名（dream/discover/gift/walk/happy）"}`;

    const result = await callBailianAPIWithTimeout([
      { role: 'system', content: PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.cute },
      { role: 'user', content: prompt },
    ]).catch(() => getLocalEvent(personality));

    const eventPayload = normalizeEventPayload(result);

    // 奖励真实入账（计入每日 200 金币防刷预算，与宠物互动共享上限，见 routes/pet.ts）
    const { coinReward, totalCoins } = grantEventCoins(userId, parseEventReward(eventPayload.reward));

    res.json({ ...eventPayload, coinReward, totalCoins });
  } catch (error: any) {
    console.error('事件生成错误:', error.message);
    res.status(500).json({ error: '事件生成失败' });
  }
});

// ============================================================
// 内部函数
// ============================================================

function buildSystemPrompt(personality: string, petState?: any, petInfo?: any, memories: string[] = []): string {
  const base = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.cute;
  if (!petState && memories.length === 0) return base;

  const stageNames: Record<string, string> = {
    egg: '宠物蛋',
    child: '幼体',
    teen: '少年',
    adult: '成年',
  };

  const lines = [base];

  // 宠物基础设定
  if (petInfo) {
    lines.push('');
    lines.push('【你的身份设定】');
    if (petInfo.name) lines.push(`- 名字: ${petInfo.name}`);
    if (petInfo.stage) lines.push(`- 成长阶段: ${stageNames[petInfo.stage] || petInfo.stage}`);
    if (petInfo.personality) lines.push(`- 性格: ${petInfo.personality}`);
    if (petInfo.level) lines.push(`- 等级: Lv.${petInfo.level}`);
    if (petInfo.totalInteractions) lines.push(`- 与主人互动次数: ${petInfo.totalInteractions}`);
  }

  // 关于主人的记忆（个性化陪伴的核心：宠物真的记得主人的事）
  if (memories.length > 0) {
    lines.push('');
    lines.push('【关于主人的记忆】（你亲身记得这些事，聊天时可自然提及，不要罗列）');
    memories.forEach(m => lines.push(`- ${m}`));
  }

  // 当前状态（petState 与记忆相互独立，任一存在即可构建）
  if (petState) {
    lines.push('');
    lines.push('【当前状态】');
    lines.push(`- 饥饿值: ${petState.hunger ?? 80}/100`);
    lines.push(`- 清洁值: ${petState.cleanliness ?? 80}/100`);
    lines.push(`- 心情值: ${petState.mood ?? 80}/100`);
    lines.push(`- 体力值: ${petState.energy ?? 80}/100`);
    lines.push(`- 健康值: ${petState.health ?? 80}/100`);
  }

  // 当前状态
  // 状态提示
  const tips: string[] = [];
  if (petState) {
    if (petState.hunger < 30) tips.push('⚠️ 非常饿，需要喂食');
    if (petState.cleanliness < 30) tips.push('⚠️ 很脏，需要清洁');
    if (petState.mood < 30) tips.push('⚠️ 心情低落，需要安慰');
    if (petState.energy < 30) tips.push('⚠️ 很累，需要休息');
    if (tips.length > 0) {
      lines.push('');
      lines.push('【状态提醒】');
      tips.forEach(t => lines.push(t));
    }

    lines.push('');
    lines.push('请根据以上设定和状态调整对话语气、内容和行为（饿了就说饿，困了就犯懒，心情低落就安慰等）');
  } else {
    lines.push('');
    lines.push('请结合记忆自然聊天，语气符合你的性格设定');
  }

  return lines.join('\n');
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

// ============================================================
// 随机事件奖励（真实入账）
// ============================================================

const MAX_EVENT_REWARD = 10;    // 单次事件奖励金币上限

/** 从 AI 返回的奖励描述中解析金币数；无数字时取 3-8 随机值，单次上限 10 */
export function parseEventReward(reward: unknown): number {
  const m = typeof reward === 'string' ? /(\d+)/.exec(reward) : null;
  const n = m ? parseInt(m[1], 10) : 3 + Math.floor(Math.random() * 6);
  return Math.min(Math.max(1, n), MAX_EVENT_REWARD);
}

/** 校验 AI 返回的事件 JSON，字段缺失/类型异常时降级为兜底值 */
function normalizeEventPayload(raw: string): { event: string; reward: string; animation: string } {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.event !== 'string' || !parsed.event) throw new Error('bad payload');
    return {
      event: parsed.event,
      reward: typeof parsed.reward === 'string' ? parsed.reward : '金币 x5',
      animation: typeof parsed.animation === 'string' ? parsed.animation : 'happy',
    };
  } catch {
    return { event: raw, reward: '金币 x5', animation: 'happy' };
  }
}

/** 事件金币入账：与宠物互动共享每日 200 金币预算（daily_interactions），事务防并发 */
function grantEventCoins(userId: string, reward: number): { coinReward: number; totalCoins: number } {
  const today = todayStr();
  let coinReward = 0;

  transaction((tx) => {
    let daily = tx.prepare('SELECT * FROM daily_interactions WHERE user_id = ? AND interaction_date = ?')
      .get(userId, today) as any;
    if (!daily) {
      tx.prepare('INSERT INTO daily_interactions (user_id, interaction_date, count, coins_earned) VALUES (?, ?, 0, 0)')
        .run(userId, today);
      daily = tx.prepare('SELECT * FROM daily_interactions WHERE user_id = ? AND interaction_date = ?')
        .get(userId, today) as any;
    }

    const remaining = MAX_COINS_PER_DAY - (daily?.coins_earned || 0);
    coinReward = Math.max(0, Math.min(reward, remaining));
    if (coinReward > 0) {
      tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinReward, userId);
      tx.prepare('UPDATE daily_interactions SET coins_earned = coins_earned + ? WHERE id = ?').run(coinReward, daily.id);
    }
  });

  const totalCoins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins || 0;
  return { coinReward, totalCoins };
}

// 本地兜底随机事件（AI API 不可用时使用）
function getLocalEvent(personality: string): string {  const events: Record<string, string[]> = {
    cute: [
      '帽子在角落里发现了一个毛线球，拍了一下午',
      '帽子晒着太阳打盹，尾巴一晃一晃的',
      '帽子偷偷把主人的袜子藏进了小窝里',
    ],
    tsundere: [
      '帽子假装不在意地路过主人，尾巴却竖得老高',
      '帽子把零食推到一边，等没人看的时候又悄悄吃掉',
      '帽子霸占了整个猫窝，谁靠近就哼一声',
    ],
    funny: [
      '帽子追自己的尾巴转了三圈，撞到了猫爬架',
      '帽子对着镜子里的自己哈气，结果被吓了一跳',
      '帽子试图跳上冰箱，中途放弃直接躺平',
    ],
    calm: [
      '帽子安静地看着窗外的雨发呆',
      '帽子轻轻蹭了蹭主人的手心，又眯上了眼',
      '帽子蜷在小窝里，呼吸轻得像一片羽毛',
    ],
    cool: [
      '帽子坐在高处俯瞰整个房间，像个沉默的王',
      '帽子对逗猫棒不屑一顾，转身只用了一秒',
      '帽子望着月亮坐了很久，不知道在想什么',
    ],
  };
  const animations = ['dream', 'discover', 'gift', 'walk', 'happy'];
  const list = events[personality] || events.cute;
  return JSON.stringify({
    event: list[Math.floor(Math.random() * list.length)],
    reward: `金币 x${3 + Math.floor(Math.random() * 5)}`,
    animation: animations[Math.floor(Math.random() * animations.length)],
  });
}

function isDailyLimitReached(userId: string): boolean {
  const record = db.prepare(`
    SELECT count FROM daily_chat WHERE user_id = ? AND chat_date = ?
  `).get(userId, todayStr()) as { count: number } | undefined;

  return (record?.count || 0) >= MAX_DAILY_MESSAGES;
}

function incrementDailyChat(userId: string): void {
  db.prepare(`
    INSERT INTO daily_chat (user_id, chat_date, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, chat_date) DO UPDATE SET count = count + 1
  `).run(userId, todayStr());
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

// ============================================================
// 宠物记忆（个性化陪伴核心：从对话提取事实，注入人设）
// ============================================================

const MAX_MEMORIES_PER_PET = 50;

/** 提取用户消息中的事实并入库（提取规则见 utils/memory.ts，可单测） */
function extractMemories(userId: string, petId: string, text: string): void {
  try {
    for (const fact of extractFacts(text)) addMemory(userId, petId, fact);
  } catch {
    // 记忆提取失败不影响对话主流程
  }
}

function addMemory(userId: string, petId: string, content: string): void {
  const now = new Date().toISOString();
  const inserted = db.prepare(`
    INSERT OR IGNORE INTO pet_memories (user_id, pet_id, content, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, petId, content, now);
  if (inserted.changes === 0) return; // 重复内容，忽略

  // 超上限时 FIFO 清理最旧的
  db.prepare(`
    DELETE FROM pet_memories
    WHERE user_id = ? AND pet_id = ?
    AND id NOT IN (
      SELECT id FROM pet_memories WHERE user_id = ? AND pet_id = ?
      ORDER BY created_at DESC, id DESC LIMIT ?
    )
  `).run(userId, petId, userId, petId, MAX_MEMORIES_PER_PET);
}

function getMemories(userId: string, petId: string, limit: number): string[] {
  return (db.prepare(`
    SELECT content FROM pet_memories
    WHERE user_id = ? AND pet_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(userId, petId, limit) as any[]).map(r => r.content);
}

// ============================================================
// 本地兜底回复（AI API 不可用时使用）
// ============================================================

function getLocalReply(personality: string, userMessage: string, petState?: any): string {
  const msg = userMessage.toLowerCase();
  const mood = petState?.mood ?? 80;
  const hunger = petState?.hunger ?? 80;

  // 关键词匹配
  const isGreeting = /你好|嗨|hi|hello|在吗/.test(msg);
  const isHowAreYou = /怎么样|好吗|还好吗|开心吗/.test(msg);
  const isHungry = /饿|吃的|喂食|粮食/.test(msg);
  const isPlay = /玩|游戏|陪我|无聊/.test(msg);
  const isSleep = /睡|困|累|休息/.test(msg);
  const isLove = /爱|喜欢|乖|可爱/.test(msg);

  // 根据性格 + 状态生成回复
  const replies: Record<string, Record<string, string[]>> = {
    cute: {
      greeting: ['喵~ 你来啦！好想你呢喵~', '喵喵！终于等到你了呢~', '嗨嗨~ 喵~'],
      howAreYou: mood > 60 ? ['超级开心喵~ 你呢？', '有你在就很好喵~'] : ['有点无聊呢... 陪我玩喵~', '心情一般喵...'],
      hungry: hunger < 40 ? ['肚子好饿喵... 想吃东西', '喵... 我饿了'] : ['现在还不太饿喵~'],
      play: ['好呀好呀！一起玩喵~', '最喜欢玩了喵！', '等等我喵~'],
      sleep: ['喵... 有点困了', '想睡觉了喵... 晚安'],
      love: ['喵~ 我也喜欢你呢！', '嘿嘿~ 好开心喵~', '蹭蹭~'],
      default: ['喵~', '嗯嗯，我在听呢喵~', '喵喵喵~', '是这样吗喵~'],
    },
    tsundere: {
      greeting: ['哼，才...才不是想你了呢！', '哦，来了啊', '哼'],
      howAreYou: mood > 60 ? ['哼，还行吧', '才...才没有很开心呢'] : ['哼，有点烦'],
      hungry: hunger < 40 ? ['饿... 才不是饿了呢'] : ['不饿！'],
      play: ['哼，陪...陪你玩一会儿好了', '随便你'],
      sleep: ['哼，我要睡了', '别打扰我'],
      love: ['哼，才...才没有高兴呢！', '笨...笨蛋'],
      default: ['哼', '哦', '随便', '哼，然后呢'],
    },
    funny: {
      greeting: ['诶嘿！你来啦哈哈哈', 'Yo！等你好久了！', '哈喽哈喽~'],
      howAreYou: mood > 60 ? ['超级好哈哈哈！', '开心到飞起！'] : ['emmm... 有点无聊哈哈哈'],
      hungry: hunger < 40 ? ['饿死了饿死了！快喂食！', '饿到想吃自己... 才怪'] : ['还不饿呢'],
      play: ['来来来！玩什么！', '终于有人陪我玩了哈哈'],
      sleep: ['zzz... 啊不好意思睡着了哈哈哈'],
      love: ['我也爱你哈哈哈！', '比心比心！'],
      default: ['哈哈这样吗', '然后呢然后呢', 'wow', '666'],
    },
    calm: {
      greeting: ['你来了呢', '嗨', '嗯，我在'],
      howAreYou: mood > 60 ? ['挺好的，谢谢', '还不错'] : ['有点累呢'],
      hungry: hunger < 40 ? ['有点饿了呢'] : ['还不饿'],
      play: ['好，陪你玩一会儿', '嗯'],
      sleep: ['那我休息一下', '晚安'],
      love: ['谢谢你', '我也是'],
      default: ['嗯', '这样啊', '我明白了', '然后呢'],
    },
    cool: {
      greeting: ['嗯', '来了', '说'],
      howAreYou: mood > 60 ? ['还行', '不错'] : ['一般'],
      hungry: hunger < 40 ? ['饿了'] : ['不饿'],
      play: ['行', '来吧', '随意'],
      sleep: ['睡吧', '晚安'],
      love: ['嗯', '知道了'],
      default: ['哦', '了解', '继续', '嗯'],
    },
  };

  const personalityReplies = replies[personality] || replies.cute;

  let pool: string[];
  if (isGreeting) pool = personalityReplies.greeting;
  else if (isHowAreYou) pool = personalityReplies.howAreYou;
  else if (isHungry) pool = personalityReplies.hungry;
  else if (isPlay) pool = personalityReplies.play;
  else if (isSleep) pool = personalityReplies.sleep;
  else if (isLove) pool = personalityReplies.love;
  else pool = personalityReplies.default;

  return pool[Math.floor(Math.random() * pool.length)];
}
