/**
 * 帽子AI宠物 - 宠物档案馆
 * 展示所有已退休宠物的纪念页，让"退休循环"有温度地收尾
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

interface RetiredPet {
  id: string;
  name: string;
  personality: string;
  stage: string;
  level: number;
  exp: number;
  totalInteractions: number;
  isRetired: boolean;
  createdAt: string;
}

const PERSONALITY_LABELS: Record<string, { label: string; emoji: string }> = {
  cute: { label: '软萌治愈', emoji: '🧸' },
  tsundere: { label: '傲娇毒舌', emoji: '😤' },
  funny: { label: '沙雕活泼', emoji: '🤪' },
  calm: { label: '温柔安静', emoji: '🌸' },
  cool: { label: '高冷佛系', emoji: '😎' },
};

const STAGE_LABELS: Record<string, string> = {
  egg: '宠物蛋',
  child: '幼体',
  teen: '少年',
  adult: '成年',
};

export default function ArchiveScreen() {
  const [pets, setPets] = useState<RetiredPet[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const result = await apiFetch<{ pets: RetiredPet[] }>('/pet');
          setPets(result.pets.filter(p => p.isRetired));
        } catch {
          setPets([]);
        }
      })();
    }, [])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🏛️</Text>
        <Text style={styles.headerTitle}>宠物档案馆</Text>
        <Text style={styles.headerSubtitle}>每一只退休的小猫都在这里被记得</Text>
      </View>

      {pets === null ? (
        <Text style={styles.loadingText}>翻阅档案中...</Text>
      ) : pets.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>🕊️</Text>
          <Text style={styles.emptyTitle}>档案馆还很安静</Text>
          <Text style={styles.emptyDesc}>陪伴一只宠物到成年后让它光荣退休，它的故事就会收藏在这里</Text>
        </View>
      ) : (
        pets.map(pet => {
          const personality = PERSONALITY_LABELS[pet.personality] || PERSONALITY_LABELS.cute;
          const daysOwned = Math.max(
            1,
            Math.floor((Date.now() - new Date(pet.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          );
          return (
            <View key={pet.id} style={styles.petCard}>
              <Text style={styles.petAvatarEmoji}>{pet.stage === 'adult' ? '😺' : '🐱'}</Text>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petMeta}>
                  {personality.emoji} {personality.label} · {STAGE_LABELS[pet.stage]} Lv.{pet.level}
                </Text>
                <Text style={styles.petMeta}>
                  共同生活 {daysOwned} 天 · 互动 {pet.totalInteractions} 次
                </Text>
              </View>
              <Text style={styles.retiredBadge}>🌟 荣誉退休</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginVertical: 20 },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#5A4A4A' },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 6 },
  loadingText: { textAlign: 'center', color: '#999', marginTop: 30 },
  emptyBox: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#5A4A4A', marginBottom: 8 },
  emptyDesc: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  petAvatarEmoji: { fontSize: 40, marginRight: 14 },
  petInfo: { flex: 1 },
  petName: { fontSize: 17, fontWeight: '700', color: '#5A4A4A', marginBottom: 4 },
  petMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  retiredBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9F43',
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
