/**
 * 帽子AI宠物 - 成就徽章页
 * 徽章墙：已解锁亮色 + 解锁日期，未解锁灰态（激励回访）
 * 惰性评估：进入页面即重新计算并持久化新解锁
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '../config/env';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  threshold: number;
  metric: string;
}

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  // 本次进入页面新解锁的徽章数与钻石奖励（成就 → 钻石 → 限定颜值 的经济闭环）
  const [reward, setReward] = useState<{ newCount: number; diamonds: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const result = await apiFetch<{
            achievements: Achievement[];
            unlockedCount: number;
            totalCount: number;
            newCount: number;
            diamondsEarned: number;
          }>('/achievements');
          setAchievements(result.achievements);
          setUnlockedCount(result.unlockedCount);
          setMetrics(result.metrics || {});
          setTotalCount(result.totalCount);
          setReward(result.newCount > 0 ? { newCount: result.newCount, diamonds: result.diamondsEarned } : null);
        } catch {
          setAchievements([]);
        }
      })();
    }, [])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🏆</Text>
        <Text style={styles.headerTitle}>成就徽章</Text>
        <Text style={styles.headerSubtitle}>
          {achievements === null ? '清点中...' : `已收集 ${unlockedCount}/${totalCount} 枚徽章 · 每枚奖励 💎5`}
        </Text>
        {reward && (
          <View style={styles.rewardBanner}>
            <Text style={styles.rewardText}>
              🎉 新解锁 {reward.newCount} 枚徽章，+💎{reward.diamonds} 已入账！
            </Text>
          </View>
        )}
      </View>

      {achievements === null ? (
        <Text style={styles.loadingText}>清点徽章中...</Text>
      ) : (
        <View style={styles.grid}>
          {achievements.map(a => (
            <View key={a.id} style={[styles.badgeCard, !a.unlocked && styles.badgeCardLocked]}>
              <Text style={[styles.badgeIcon, !a.unlocked && styles.badgeIconLocked]}>{a.icon}</Text>
              <Text style={[styles.badgeTitle, !a.unlocked && styles.badgeTitleLocked]}>{a.title}</Text>
              <Text style={styles.badgeDesc}>{a.unlocked ? a.description : '？？？'}</Text>
              {!a.unlocked && (
                <View style={styles.badgeProgressWrap}>
                  <View style={styles.badgeProgressBg}>
                    <View style={[styles.badgeProgressFill, { width: `${Math.min(100, Math.round(((metrics[a.metric] || 0) / a.threshold) * 100))}%` }]} />
                  </View>
                  <Text style={styles.badgeProgressText}>
                    {metrics[a.metric] || 0}/{a.threshold}
                  </Text>
                </View>
              )}
              <Text style={styles.badgeDate}>
                {a.unlocked && a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString('zh-CN') : '未解锁'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {achievements !== null && unlockedCount === 0 && (
        <Text style={styles.hintText}>和帽子互动、聊天、交朋友、玩猜拳都会解锁徽章哦~</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badgeProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  badgeProgressBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#EFE8DE', overflow: 'hidden' },
  badgeProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#D9B88F' },
  badgeProgressText: { fontSize: 10, color: '#B0A090', minWidth: 34, textAlign: 'right' },
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginVertical: 20 },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#5A4A4A' },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 6 },
  rewardBanner: {
    marginTop: 10,
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  rewardText: { fontSize: 13, color: '#5A7A6A', fontWeight: '600' },
  loadingText: { textAlign: 'center', color: '#999', marginTop: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  badgeCard: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE3C2',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  badgeCardLocked: { borderColor: '#F0F0F0', opacity: 0.75 },
  badgeIcon: { fontSize: 34, marginBottom: 6 },
  badgeIconLocked: { opacity: 0.35 },
  badgeTitle: { fontSize: 13, fontWeight: '600', color: '#5A4A4A', textAlign: 'center' },
  badgeTitleLocked: { color: '#BBB' },
  badgeDesc: { fontSize: 10, color: '#999', textAlign: 'center', marginTop: 4, lineHeight: 14 },
  badgeDate: { fontSize: 10, color: '#FF9F43', marginTop: 6 },
  hintText: { fontSize: 12, color: '#BBB', textAlign: 'center', marginTop: 20 },
});
