/**
 * 帽子AI宠物 - 推送召回（Expo Push）
 * 宠物口吻文案 + 状态驱动触发 + 每宠物每类型每天最多一条（防骚扰）
 * Expo API 用原生 fetch 调用，零新依赖；无效令牌自动清理
 */
import db from '../db';
import { todayStr } from './today';

// Expo Push API（免费额度无需令牌；配置 EXPO_ACCESS_TOKEN 后享更高配额）
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** 触发条件：属性低于阈值 + 宠物口吻文案（系统不说人话，宠物才说） */
export const CARE_KINDS = {
  hungry: { threshold: 30, column: 'stats_hunger', title: '🍖 好饿呀…', body: (name: string) => `${name}的肚子在咕咕叫，主人快回来喂喂我嘛~` },
  sad: { threshold: 30, column: 'stats_mood', title: '😢 想你了…', body: (name: string) => `${name}的心情有点低落，抱抱我就好起来了…` },
} as const;

export type CareKind = keyof typeof CARE_KINDS;

const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[a-zA-Z0-9-_]{8,}\]$/;

/** 注册/更新设备令牌；格式校验拒绝非 Expo 令牌 */
export function registerPushToken(userId: string, token: string): boolean {
  if (!EXPO_TOKEN_RE.test(token)) return false;
  db.prepare(`
    INSERT INTO push_tokens (user_id, token, created_at) VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id
  `).run(userId, token, new Date().toISOString());
  return true;
}

interface PushTarget {
  token: string;
  petId: string;
  petName: string;
  kind: CareKind;
}

/** 找出需要照料提醒的宠物（用户已注册令牌、属性低于阈值、今日未推过） */
function collectCarePushes(): PushTarget[] {
  const today = todayStr();
  const targets: PushTarget[] = [];

  for (const [kind, cfg] of Object.entries(CARE_KINDS)) {
    const rows = db.prepare(`
      SELECT pt.token, p.id AS petId, p.name AS petName
      FROM pets p
      JOIN push_tokens pt ON pt.user_id = p.user_id
      WHERE p.is_retired = 0
        AND ${cfg.column} < ${cfg.threshold}
        AND NOT EXISTS (
          SELECT 1 FROM push_sent s
          WHERE s.pet_id = p.id AND s.kind = ? AND s.sent_date = ?
        )
    `).all(kind, today) as any[];

    for (const r of rows) {
      targets.push({ token: r.token, petId: r.petId, petName: r.petName, kind: kind as CareKind });
    }
  }
  return targets;
}

interface ExpoPushResult {
  status: string;
  message?: string;
  details?: { error?: string };
}

/** 调用 Expo Push API；返回 (成功令牌数, 无效令牌列表) */
async function sendExpoPush(messages: Array<{ to: string; title: string; body: string; sound?: string }>)
  : Promise<{ sent: number; invalidTokens: string[] }> {
  if (messages.length === 0) return { sent: 0, invalidTokens: [] };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const resp = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!resp.ok) throw new Error(`Expo API ${resp.status}`);
  const data = await resp.json() as { data?: ExpoPushResult[] };

  const invalidTokens: string[] = [];
  let sent = 0;
  (data.data || []).forEach((r, i) => {
    if (r.status === 'ok') {
      sent++;
    } else if (r.details?.error === 'DeviceNotRegistered') {
      invalidTokens.push(messages[i].to);
    }
    // 其他错误（消息过大等）仅记录，不视为发送成功
  });
  return { sent, invalidTokens };
}

/**
 * 扫描并派发照料推送。返回统计供测试/日志。
 * 防骚扰：INSERT OR IGNORE 抢占当日名额，抢到才发送（并发安全）；
 * Expo 判定设备未注册时清理令牌。
 */
export async function dispatchPetCarePushes(): Promise<{
  attempted: number; sent: number; invalidRemoved: number;
}> {
  const today = todayStr();
  const targets = collectCarePushes();
  let sent = 0;
  let invalidRemoved = 0;

  const messages: Array<{ to: string; title: string; body: string; kind: CareKind; petId: string }> = [];
  for (const t of targets) {
    const grabbed = db.prepare(`
      INSERT OR IGNORE INTO push_sent (pet_id, kind, sent_date) VALUES (?, ?, ?)
    `).run(t.petId, t.kind, today);
    if (grabbed.changes > 0) {
      const cfg = CARE_KINDS[t.kind];
      messages.push({ to: t.token, title: cfg.title, body: cfg.body(t.petName), kind: t.kind, petId: t.petId });
    }
  }

  if (messages.length > 0) {
    try {
      const result = await sendExpoPush(messages.map(({ to, title, body }) => ({ to, title, body, sound: 'default' })));
      sent = result.sent;
      for (const bad of result.invalidTokens) {
        invalidRemoved += db.prepare('DELETE FROM push_tokens WHERE token = ?').run(bad).changes;
      }
    } catch (err) {
      // 发送失败：释放今日名额，下个周期重试
      for (const m of messages) {
        db.prepare('DELETE FROM push_sent WHERE pet_id = ? AND kind = ? AND sent_date = ?')
          .run(m.petId, m.kind, today);
      }
      throw err;
    }
  }

  return { attempted: messages.length, sent, invalidRemoved };
}
