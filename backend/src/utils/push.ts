/**
 * 帽子AI宠物 - 推送召回（Expo Push）
 * 宠物口吻文案 + 状态驱动触发 + 每宠物每类型每天最多一条（防骚扰）
 * Expo API 用原生 fetch 调用，零新依赖；无效令牌自动清理
 */
import db from '../db';
import { todayStr } from './today';
import { calcStreakWithFreeze, parseDayList } from './habits';

// Expo Push API（免费额度无需令牌；配置 EXPO_ACCESS_TOKEN 后享更高配额）
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** 触发条件：属性低于阈值 + 宠物口吻文案（系统不说人话，宠物才说） */
export const CARE_KINDS = {
  hungry: { threshold: 30, column: 'stats_hunger', title: '🍖 好饿呀…', body: (name: string) => `${name}的肚子在咕咕叫，主人快回来喂喂我嘛~` },
  sad: { threshold: 30, column: 'stats_mood', title: '😢 想你了…', body: (name: string) => `${name}的心情有点低落，抱抱我就好起来了…` },
} as const;

export type CareKind = keyof typeof CARE_KINDS;

const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[a-zA-Z0-9-_]{8,}\]$/;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 免打扰时段判定（纯函数，可单测）
 * @param start "HH:MM"，null/非法 = 不启用
 * @param end   "HH:MM"；start > end 表示跨零点窗口（如 22:00→08:00）
 */
export function isWithinQuietHours(now: Date, start?: string | null, end?: string | null): boolean {
  if (!start || !end || !HHMM_RE.test(start) || !HHMM_RE.test(end)) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return false; // 起止相同视为未启用
  if (s < e) return minutes >= s && minutes < e; // 同日窗口
  return minutes >= s || minutes < e; // 跨零点窗口
}

/** 校验并规范化免打扰设置；不合法返回 null */
export function parseQuietTime(v: unknown): string | null {
  return typeof v === 'string' && HHMM_RE.test(v) ? v : null;
}

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

/** 找出需要照料提醒的宠物（用户已注册令牌、属性低于阈值、今日未推过、不在免打扰时段） */
function collectCarePushes(now: Date = new Date()): PushTarget[] {
  const today = todayStr();
  const targets: PushTarget[] = [];

  for (const [kind, cfg] of Object.entries(CARE_KINDS)) {
    const rows = db.prepare(`
      SELECT pt.token, p.id AS petId, p.name AS petName,
             u.push_quiet_start AS quietStart, u.push_quiet_end AS quietEnd
      FROM pets p
      JOIN push_tokens pt ON pt.user_id = p.user_id
      JOIN users u ON u.id = p.user_id
      WHERE p.is_retired = 0
        AND ${cfg.column} < ${cfg.threshold}
        AND NOT EXISTS (
          SELECT 1 FROM push_sent s
          WHERE s.pet_id = p.id AND s.kind = ? AND s.sent_date = ?
        )
    `).all(kind, today) as any[];

    for (const r of rows) {
      // 免打扰时段内的目标静默跳过（不占当日名额，出窗口后照常推送）
      if (isWithinQuietHours(now, r.quietStart, r.quietEnd)) continue;
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

// ============================================================
// 习惯打卡提醒（Round 19）
// 竞品依据：2026 推送共识「行为触发 > 固定时间」（AppBot/OneSignal）+ 反焦虑文案
// （habi.app）；轻量版自适应：晚间窗口内扫描、只提醒已有 streak 的习惯（保护既有
// 积累，对标 Duolingo streak 保护）、每用户每日最多 1 条（挑 streak 最高的打）
// ============================================================

/** 提醒窗口：本地 18:00-22:00（一天将尽、碎片时间档；避开清晨/工作时段） */
export const HABIT_REMIND_START_HOUR = 18;
export const HABIT_REMIND_END_HOUR = 22;

export function isHabitRemindWindow(now: Date): boolean {
  const h = now.getHours();
  return h >= HABIT_REMIND_START_HOUR && h < HABIT_REMIND_END_HOUR;
}

export interface HabitReminderCandidate {
  id: string;
  name: string;
  streak: number;
  checkedToday: boolean;
}

/** 用户的习惯提醒窗口：自定义小时 [h, h+1)；未设置/非法则回退默认 18-22 点 */
export function habitRemindWindowForUser(customHour: number | null | undefined, now: Date): boolean {
  if (customHour === null || customHour === undefined) return isHabitRemindWindow(now);
  const h = Math.floor(customHour);
  if (!Number.isInteger(h) || h < 0 || h > 23) return isHabitRemindWindow(now);
  return now.getHours() === h;
}

/** 挑最该提醒的习惯：今天没打 + streak ≥ 1（已开头的才值得守护）→ streak 最高优先 */
export function pickHabitReminder(cands: HabitReminderCandidate[]): HabitReminderCandidate | null {
  const due = cands.filter(c => !c.checkedToday && c.streak >= 1);
  if (due.length === 0) return null;
  return due.reduce((best, c) => (c.streak > best.streak ? c : best), due[0]);
}

/** 宠物口吻文案：提醒而非责备（断签不施压，正向框架） */
export function habitReminderCopy(
  habitName: string, streak: number, petName: string | null
): { title: string; body: string } {
  if (petName) {
    if (streak >= 2) {
      return {
        title: '🌱 别断了呀',
        body: `${petName}数着呢：「${habitName}」连续 ${streak} 天了，今天也一起加油？`,
      };
    }
    return {
      title: '🌱 开了个好头',
      body: `「${habitName}」的第 2 天就要来了，${petName}陪你一起～`,
    };
  }
  return { title: '🌱 今天也别断', body: `「${habitName}」连续 ${streak} 天了，去打卡吧` };
}

interface HabitReminderTarget {
  token: string;
  habitId: string;
  habitName: string;
  streak: number;
  petName: string | null;
}

/** 扫描习惯提醒目标：有令牌、不在免打扰时段、窗口内、当日未提醒过的用户（≤1 条/人/日） */
function collectHabitReminderPushes(now: Date = new Date()): HabitReminderTarget[] {
  const today = todayStr();

  const tokenRows = db.prepare(`
    SELECT pt.user_id AS userId, pt.token,
           u.push_quiet_start AS quietStart, u.push_quiet_end AS quietEnd,
           u.habit_remind_hour AS remindHour
    FROM push_tokens pt JOIN users u ON u.id = pt.user_id
  `).all() as any[];

  const targets: HabitReminderTarget[] = [];
  for (const row of tokenRows) {
    if (isWithinQuietHours(now, row.quietStart, row.quietEnd)) continue;
    if (!habitRemindWindowForUser(row.remindHour, now)) continue;

    // 每用户每日最多 1 条习惯提醒（push_sent 以 habit_id 入 pet_id 槽、kind='habit'）
    const reminded = db.prepare(`
      SELECT 1 FROM push_sent s JOIN user_habits h ON h.id = s.pet_id
      WHERE h.user_id = ? AND s.kind = 'habit' AND s.sent_date = ? LIMIT 1
    `).get(row.userId, today);
    if (reminded) continue;

    const habits = db.prepare('SELECT id, name, freezes, freeze_dates FROM user_habits WHERE user_id = ? AND archived = 0').all(row.userId) as any[];
    const cands = habits.map(h => {
      const days = (db.prepare('SELECT checkin_date FROM habit_checkins WHERE habit_id = ?').all(h.id) as any[])
        .map(r => r.checkin_date as string);
      // 冻结券桥接口径：streak 被券保护时仍视为存活，值得提醒守护
      return { id: h.id, name: h.name, streak: calcStreakWithFreeze(days, today, h.freezes, parseDayList(h.freeze_dates)).streak, checkedToday: days.includes(today) };
    });
    const pick = pickHabitReminder(cands);
    if (!pick) continue;

    const pet = db.prepare('SELECT name FROM pets WHERE user_id = ? AND is_retired = 0 ORDER BY created_at DESC LIMIT 1').get(row.userId) as any;
    targets.push({ token: row.token, habitId: pick.id, habitName: pick.name, streak: pick.streak, petName: pet?.name ?? null });
  }
  return targets;
}

/**
 * 扫描并派发习惯提醒。防骚扰/失败回滚语义与照料推送一致：
 * INSERT OR IGNORE 抢占名额，Expo 发送失败释放名额下轮重试，无效令牌清理。
 * @param now 可注入时间（测试用；默认当前时刻）
 */
export async function dispatchHabitReminderPushes(now: Date = new Date()): Promise<{
  attempted: number; sent: number; invalidRemoved: number;
}> {
  const today = todayStr();
  const targets = collectHabitReminderPushes(now);
  let sent = 0;
  let invalidRemoved = 0;

  const messages: Array<{ to: string; title: string; body: string; habitId: string }> = [];
  for (const t of targets) {
    const grabbed = db.prepare(`INSERT OR IGNORE INTO push_sent (pet_id, kind, sent_date) VALUES (?, 'habit', ?)`)
      .run(t.habitId, today);
    if (grabbed.changes > 0) {
      const copy = habitReminderCopy(t.habitName, t.streak, t.petName);
      messages.push({ to: t.token, ...copy, habitId: t.habitId });
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
      for (const m of messages) {
        db.prepare(`DELETE FROM push_sent WHERE pet_id = ? AND kind = 'habit' AND sent_date = ?`)
          .run(m.habitId, today);
      }
      throw err;
    }
  }

  return { attempted: messages.length, sent, invalidRemoved };
}
