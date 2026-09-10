/**
 * 帽子AI宠物 - 习惯打卡路由
 * GET  /api/habits           习惯列表（含 streak/今日打卡状态）
 * POST /api/habits           新建习惯（最多 3 个进行中）
 * POST /api/habits/:id/check 今日打卡（幂等，UNIQUE 主键防并发重复）
 * DELETE /api/habits/:id     软删除（归档保留历史）
 *
 * 打卡奖励：宠物 +心情5 / 用户 +金币2（微量；每日只给前 MAX_HABITS 次打卡发币，
 * 防「打卡→归档→重建」循环刷币，后续打卡保留连续天数与心情奖励）。
 * streak 里程碑（3/7/14/21 天）→ 宠物经验（每习惯每里程碑终身一次，awarded_milestones 防重爬刷经验）
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';
import { todayStr } from '../utils/today';
import {
  MAX_HABITS, CHECK_MOOD, CHECK_COINS, MAX_FREEZES, calcStreakWithFreeze,
  grantFreezes, parseDayList, serializeDayList,
  pendingMilestone, nextMilestone, parseAwarded, serializeAwarded, MilestoneDef,
} from '../utils/habits';
import { applyExp } from '../utils/growth';
import { normalizePersonality, habitCheer } from '../utils/personality';
import { bumpTaskProgress } from '../utils/tasks';

export const habitsRouter = Router();

interface HabitRow {
  id: string;
  name: string;
  icon: string;
  created_at: string;
  freezes: number;
  freeze_dates: string | null;
}

// 习惯列表（含 streak（冻结券桥接口径）/ 今日已打卡 / 累计天数 / 冻结券余量）
habitsRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const habits = db.prepare('SELECT id, name, icon, created_at, freezes, freeze_dates FROM user_habits WHERE user_id = ? AND archived = 0 ORDER BY created_at').all(userId) as HabitRow[];
  const today = todayStr();

  const list = habits.map(h => {
    const days = (db.prepare('SELECT checkin_date FROM habit_checkins WHERE habit_id = ?').all(h.id) as any[])
      .map(r => r.checkin_date as string);
    const frozen = calcStreakWithFreeze(days, today, h.freezes, parseDayList(h.freeze_dates));
    const next = nextMilestone(frozen.streak);
    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      streak: frozen.streak,
      checkedToday: days.includes(today),
      totalCheckins: days.length,
      // 最近 30 天打卡日期（前端热力条）
      recentDates: [...new Set(days.filter(d => {
        const [y, m, dd] = d.split('-').map(Number);
        const t = new Date(y, m - 1, dd).getTime();
        return t >= Date.now() - 30 * 86400000 && t <= Date.now() + 86400000;
      }))].sort(),
      freezes: Math.max(0, Math.min(MAX_FREEZES, h.freezes)),
      // 濒断但有券：预览口径已把昨天桥接进来（未消费），前端可提示「冻结券保护中」
      freezeProtected: frozen.newFrozenDays.length > 0,
      nextMilestoneDays: next?.days ?? null,
      nextMilestoneExp: next?.exp ?? null,
    };
  });

  res.json({
    habits: list,
    todayDone: list.length > 0 && list.every(h => h.checkedToday),
    maxHabits: MAX_HABITS,
  });
});

// 新建习惯
habitsRouter.post('/', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const icon = typeof req.body.icon === 'string' && req.body.icon.length > 0 && req.body.icon.length <= 8
    ? req.body.icon : '🌱';

  if (!name || name.length > 20) {
    res.status(400).json({ error: '习惯名字需要 1-20 个字符' });
    return;
  }

  const activeCount = (db.prepare('SELECT COUNT(*) AS n FROM user_habits WHERE user_id = ? AND archived = 0').get(userId) as any).n;
  if (activeCount >= MAX_HABITS) {
    res.status(400).json({ error: `最多同时进行 ${MAX_HABITS} 个习惯，先完成已有的吧` });
    return;
  }

  const id = uuidv4();
  db.prepare('INSERT INTO user_habits (id, user_id, name, icon, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, userId, name, icon, new Date().toISOString());

  res.json({ message: `🌱 习惯「${name}」创建成功，记得每天来打卡`, id });
});

// 今日打卡（INSERT OR IGNORE + changes 判定天然防并发/防重复）
habitsRouter.post('/:id/check', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { id } = req.params;
  const today = todayStr();

  const habit = db.prepare('SELECT id, name, awarded_milestones, freezes, freeze_dates FROM user_habits WHERE id = ? AND user_id = ? AND archived = 0').get(id, userId) as (HabitRow & { awarded_milestones: string | null }) | undefined;
  if (!habit) {
    res.status(404).json({ error: '习惯不存在' });
    return;
  }

  let coinReward = 0;
  let petMoodApplied = false;
  let petSleeping = false;
  let petName = '';
  let petPersonality = '';
  let streak = 0;
  let freezesLeft = Math.max(0, Math.min(MAX_FREEZES, habit.freezes));
  let frozenDaysUsed = 0;
  type MilestoneAward = MilestoneDef & { petName: string; newLevel: number; leveledUp: boolean };
  let milestoneAwarded: MilestoneAward | null = null;

  try {
    milestoneAwarded = transaction((tx): MilestoneAward | null => {
      const result = tx.prepare('INSERT OR IGNORE INTO habit_checkins (habit_id, user_id, checkin_date, created_at) VALUES (?, ?, ?, ?)')
        .run(id, userId, today, new Date().toISOString());
      if (result.changes === 0) {
        throw new Error('ALREADY_CHECKED');
      }

      // 打卡记录落库后：宠物 +心情（睡觉中不扰动心情，退休宠物无奖励对象）、用户 +金币
      // 金币每日只发前 MAX_HABITS 次（归档重建 3 个新习惯再打卡也拿不到第 4 份金币）
      const todayCount = (tx.prepare('SELECT COUNT(*) AS n FROM habit_checkins WHERE user_id = ? AND checkin_date = ?')
        .get(userId, today) as any).n;
      coinReward = todayCount <= MAX_HABITS ? CHECK_COINS : 0;
      if (coinReward > 0) {
        tx.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(coinReward, userId);
      }

      const pet = tx.prepare('SELECT id, name, personality, is_sleeping, stats_mood, level, exp, stage FROM pets WHERE user_id = ? AND is_retired = 0 ORDER BY created_at DESC LIMIT 1').get(userId) as any;
      if (pet) {
        petName = pet.name;
        petPersonality = pet.personality;
        if (pet.is_sleeping) {
          petSleeping = true;
        } else {
          const newMood = Math.min(100, pet.stats_mood + CHECK_MOOD);
          tx.prepare('UPDATE pets SET stats_mood = ?, updated_at = ? WHERE id = ?').run(newMood, new Date().toISOString(), pet.id);
          petMoodApplied = true;
        }
      }

      // streak（冻结券桥接口径）：漏打 1 天自动消费 1 张桥接，消费只在打卡时刻落库
      const days = (tx.prepare('SELECT checkin_date FROM habit_checkins WHERE habit_id = ?').all(id) as any[])
        .map(r => r.checkin_date as string);
      const frozen = calcStreakWithFreeze(days, today, habit.freezes, parseDayList(habit.freeze_dates));
      streak = frozen.streak;
      const frozenDates = parseDayList(habit.freeze_dates);
      for (const d of frozen.newFrozenDays) frozenDates.add(d);
      frozenDaysUsed = frozen.newFrozenDays.length;
      freezesLeft = Math.max(0, habit.freezes - frozenDaysUsed);

      // 里程碑 → 宠物经验（与心情/金币同事务）。睡觉也发：经验是成长结算而非即时状态，
      // 唤醒结算只写 stats 列不覆盖 level/exp/stage；退休/无宠物时跳过且不标记，
      // pendingMilestone 的 >= 语义保证之后打卡自动补发
      const awarded = parseAwarded(habit.awarded_milestones);
      const milestone = pendingMilestone(streak, awarded);
      if (milestone) {
        // 7/14/21 天档奖励冻结券（3 天档不给）；无宠物也照发券（券是习惯资产，不依赖宠物）
        freezesLeft = grantFreezes(freezesLeft, milestone.days);
        if (pet) {
          const growth = applyExp(pet, milestone.exp);
          tx.prepare('UPDATE pets SET level = ?, exp = ?, stage = ?, updated_at = ? WHERE id = ?')
            .run(growth.level, growth.exp, growth.stage, new Date().toISOString(), pet.id);
          milestoneAwarded = { ...milestone, petName: pet.name, newLevel: growth.level, leveledUp: growth.leveledUp };
          awarded.add(milestone.days);
        }
      }
      // 冻结券消费/奖励 + 里程碑标记合并为一次 user_habits 写入
      if (frozenDaysUsed > 0 || milestone) {
        tx.prepare('UPDATE user_habits SET freezes = ?, freeze_dates = ?, awarded_milestones = ? WHERE id = ?')
          .run(freezesLeft, serializeDayList(frozenDates), serializeAwarded(awarded), id);
      }
      return milestoneAwarded;
    });
  } catch (err: any) {
    if (err.message === 'ALREADY_CHECKED') {
      res.status(400).json({ error: '今天已经打过卡啦，明天再来 💪' });
      return;
    }
    throw err;
  }

  // 现实习惯接入每日任务闭环（habit1：完成 1 次习惯打卡）
  bumpTaskProgress(userId, 'habit1');

  // 无压力文案：streak=1 是重爬第一天，用「重新启程」而非「连续 1 天」的生硬表述
  const streakText = streak === 1 ? '🌱 重新启程第 1 天' : `🔥 连续 ${streak} 天`;
  let message = `✅ 「${habit.name}」打卡成功 ${streakText}`;
  if (coinReward > 0) message += ` 🪙+${coinReward}`;
  if (petMoodApplied) message += ` ${petName} 心情+${CHECK_MOOD}`;
  else if (petSleeping) message += `（${petName} 睡得正香 😴 心情奖励明天继续）`;
  // 性格外显：醒着时宠物用自己性格的口吻鼓励主人（睡觉走 Zzz 语义不插话）
  if (petName && !petSleeping) message += ` ${petName}${habitCheer(normalizePersonality(petPersonality))}`;
  if (frozenDaysUsed > 0) message += ` 🧊 冻结券帮你把漏打的${frozenDaysUsed}天补上了，连续记录保住啦`;
  if (milestoneAwarded) {
    message += ` 🎉 ${milestoneAwarded.icon} ${milestoneAwarded.title}达成！${milestoneAwarded.petName} 经验+${milestoneAwarded.exp}`;
    if (milestoneAwarded.leveledUp) message += `，升到 Lv.${milestoneAwarded.newLevel}！`;
  }

  const coins = (db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as any)?.coins ?? 0;
  res.json({ message, streak, coinReward, petMoodApplied, totalCoins: coins, milestone: milestoneAwarded, freezesLeft });
});

// 删除习惯（软删除：归档保留打卡历史，防 streak 口径断裂）
habitsRouter.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { id } = req.params;

  const result = db.prepare('UPDATE user_habits SET archived = 1 WHERE id = ? AND user_id = ? AND archived = 0').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: '习惯不存在或已删除' });
    return;
  }
  res.json({ message: '习惯已删除（打卡历史保留）' });
});
