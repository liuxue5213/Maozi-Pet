/**
 * 帽子AI宠物 - 成长档案（数据看板）
 * 把 achievements metrics 已聚合的 12 项数据可视化为统计卡（纯前端，零后端改动）
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { apiFetch } from '../config/env';
import { usePetStore } from '../store/petStore';

interface Metrics {
  interactions: number;
  chats: number;
  friends: number;
  visitInteractions: number;
  rpsWins: number;
  adultPets: number;
  retiredPets: number;
  habitStreak: number;
  memoryWins: number;
  moleGames: number;
  memories: number;
}

export default function StatsScreen() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [checkinStreak, setCheckinStreak] = useState(0);
  const petName = usePetStore(s => s.pet?.name) || '帽子';

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<{ metrics: Metrics }>('/achievements');
      setMetrics(result.metrics);
    } catch {
      setMetrics(null);
    }
    try {
      const c = await apiFetch<{ currentStreak: number }>('/shop/checkin');
      setCheckinStreak(c.currentStreak || 0);
    } catch { /* 静默 */ }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cards: { icon: string; label: string; value: number | string; hint: string }[] = metrics ? [
    { icon: '🤝', label: '互动', value: metrics.interactions, hint: '与宠物互动总次数' },
    { icon: '💬', label: '聊天', value: metrics.chats, hint: '和帽子说过的话' },
    { icon: '🧠', label: '记忆', value: metrics.memories, hint: '它记下关于你的事' },
    { icon: '🔥', label: '习惯连击', value: metrics.habitStreak, hint: '最高连续打卡天数' },
    { icon: '📅', label: '签到', value: checkinStreak, hint: '连续签到天数' },
    { icon: '✊', label: '猜拳胜场', value: metrics.rpsWins, hint: '累计赢下的猜拳' },
    { icon: '🃏', label: '翻牌通关', value: metrics.memoryWins, hint: '记忆翻牌获胜局数' },
    { icon: '🔨', label: '打地鼠', value: metrics.moleGames, hint: '挥锤的局数' },
    { icon: '🏠', label: '串门', value: metrics.visitInteractions, hint: '去好友家互动次数' },
    { icon: '👋', label: '好友', value: metrics.friends, hint: '当前好友数' },
    { icon: '🌱', label: '成年宠物', value: metrics.adultPets, hint: '走到成年的伙伴' },
    { icon: '🌟', label: '荣誉退休', value: metrics.retiredPets, hint: '档案馆里的老朋友' },
  ] : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← 返回</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📊</Text>
        <Text style={styles.headerTitle}>成长档案</Text>
        <Text style={styles.headerSubtitle}>你和{petName}一起走过的每一步都算数</Text>
      </View>

      {metrics === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#C4A484" />
      ) : (
        <View style={styles.grid}>
          {cards.map(c => (
            <View key={c.label} style={styles.card}>
              <Text style={styles.cardIcon}>{c.icon}</Text>
              <Text style={styles.cardValue}>{c.value}</Text>
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Text style={styles.cardHint}>{c.hint}</Text>
            </View>
          ))}
        </View>
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
  headerEmoji: { fontSize: 40, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#5A4A4A' },
  headerSubtitle: { fontSize: 12, color: '#A89888', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  card: {
    width: '31.5%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardIcon: { fontSize: 22 },
  cardValue: { fontSize: 20, fontWeight: '800', color: '#5A4A4A', marginTop: 4 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#8A7A6A', marginTop: 2 },
  cardHint: { fontSize: 9, color: '#C0B4A8', textAlign: 'center', marginTop: 2 },
});
