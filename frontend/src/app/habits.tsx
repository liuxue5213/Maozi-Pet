/**
 * 帽子AI宠物 - 习惯打卡页
 * 现实习惯每日打卡 → 宠物 +心情 / 用户 +金币（对标 Finch/OtterLife 工具型养成）
 * 最多 3 个进行中习惯；streak 连续天数外显；软删除保留历史
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { apiFetch } from '../config/env';
import { usePetStore } from '../store/petStore';

interface Habit {
  id: string;
  name: string;
  icon: string;
  streak: number;
  checkedToday: boolean;
  totalCheckins: number;
}

const ICON_CHOICES = ['🌱', '💧', '🏃', '📚', '🧘', '🌅', '🥗', '😴'];

export default function HabitsScreen() {
  const updateCoins = usePetStore(s => s.updateCoins);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [todayDone, setTodayDone] = useState(false);
  const [maxHabits, setMaxHabits] = useState(3);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🌱');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // 两段点击确认删除（3 秒窗口，Alert.alert Web 端 no-op 的平台无关替代）
  const confirmDeleteId = useRef<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<{ habits: Habit[]; todayDone: boolean; maxHabits: number }>('/habits');
      setHabits(result.habits);
      setTodayDone(result.todayDone);
      setMaxHabits(result.maxHabits);
    } catch {
      setHabits([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const addHabit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ message: string }>('/habits', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, icon }),
      });
      flash(result.message);
      setName('');
      setIcon('🌱');
      await load();
    } catch (err: any) {
      flash(err.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const checkHabit = async (habit: Habit) => {
    if (habit.checkedToday || busy) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ message: string; totalCoins: number }>(`/habits/${habit.id}/check`, {
        method: 'POST',
      });
      flash(result.message);
      updateCoins(result.totalCoins);
      await load();
    } catch (err: any) {
      flash(err.message || '打卡失败');
    } finally {
      setBusy(false);
    }
  };

  const removeHabit = async (habit: Habit) => {
    if (confirmDeleteId.current !== habit.id) {
      confirmDeleteId.current = habit.id;
      flash('再点一次确认删除');
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => {
        confirmDeleteId.current = null;
      }, 3000);
      return;
    }
    confirmDeleteId.current = null;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    try {
      await apiFetch(`/habits/${habit.id}`, { method: 'DELETE' });
      flash('习惯已删除');
      await load();
    } catch (err: any) {
      flash(err.message || '删除失败');
    }
  };

  const canAdd = habits !== null && habits.length < maxHabits;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← 返回</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🌱</Text>
        <Text style={styles.headerTitle}>习惯打卡</Text>
        <Text style={styles.headerSubtitle}>坚持现实中的好习惯，帽子陪你一起成长</Text>
        <Text style={styles.headerReward}>每次打卡：宠物 +5 心情 · 你 +2 金币</Text>
      </View>

      {message !== '' && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}

      {habits === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#C4A484" />
      ) : (
        <>
          {todayDone && (
            <View style={styles.doneBanner}>
              <Text style={styles.doneBannerText}>🎉 今日习惯全部完成，明天见！</Text>
            </View>
          )}

          {habits.map(habit => (
            <View key={habit.id} style={styles.habitCard}>
              <View style={styles.habitLeft}>
                <Text style={styles.habitIcon}>{habit.icon}</Text>
                <View>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <Text style={styles.habitMeta}>
                    {habit.streak > 0 ? `🔥 连续 ${habit.streak} 天` : '今天还没打卡'} · 累计 {habit.totalCheckins} 次
                  </Text>
                </View>
              </View>
              <View style={styles.habitActions}>
                <TouchableOpacity
                  style={[styles.checkBtn, habit.checkedToday && styles.checkBtnDone]}
                  disabled={habit.checkedToday || busy}
                  onPress={() => checkHabit(habit)}
                >
                  <Text style={styles.checkBtnText}>{habit.checkedToday ? '✅ 已打卡' : '打卡'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeHabit(habit)}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {canAdd ? (
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>＋ 新习惯（最多 {maxHabits} 个）</Text>
              <View style={styles.iconRow}>
                {ICON_CHOICES.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.iconChip, icon === emoji && styles.iconChipActive]}
                    onPress={() => setIcon(emoji)}
                  >
                    <Text style={styles.iconChipText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.input}
                  placeholder="例如：每天喝 8 杯水"
                  placeholderTextColor="#C0B4A8"
                  value={name}
                  maxLength={20}
                  onChangeText={setName}
                />
                <TouchableOpacity style={[styles.addBtn, (!name.trim() || busy) && styles.addBtnDisabled]} onPress={addHabit} disabled={!name.trim() || busy}>
                  <Text style={styles.addBtnText}>创建</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.limitHint}>进行中的习惯已满 {maxHabits} 个，坚持就是胜利 💪</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF9F3' },
  content: { padding: 16, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12 },
  backText: { fontSize: 15, color: '#8A7A6A', fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 16 },
  headerEmoji: { fontSize: 44, marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#5A4A4A' },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 6 },
  headerReward: { fontSize: 12, color: '#B08D57', marginTop: 8, fontWeight: '600' },
  toast: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  toastText: { fontSize: 13, color: '#4A6A4A', fontWeight: '600', textAlign: 'center' },
  doneBanner: {
    backgroundColor: '#FFF6D9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  doneBannerText: { fontSize: 14, color: '#8A6A2A', fontWeight: '700' },
  habitCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  habitLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  habitIcon: { fontSize: 26 },
  habitName: { fontSize: 15, fontWeight: '700', color: '#5A4A4A' },
  habitMeta: { fontSize: 12, color: '#A89888', marginTop: 3 },
  habitActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkBtn: {
    backgroundColor: '#E8A87C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  checkBtnDone: { backgroundColor: '#D8E8D8' },
  checkBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 15 },
  addCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
  },
  addTitle: { fontSize: 14, fontWeight: '700', color: '#5A4A4A', marginBottom: 10 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipActive: { backgroundColor: '#FFE0C7', borderWidth: 2, borderColor: '#E8A87C' },
  iconChipText: { fontSize: 20 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#F8F4EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#5A4A4A',
  },
  addBtn: {
    backgroundColor: '#E8A87C',
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#E0D5C8' },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  limitHint: { textAlign: 'center', fontSize: 13, color: '#A89888', marginTop: 14 },
});
