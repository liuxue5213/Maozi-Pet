/**
 * 帽子AI宠物 - 宠物档案馆
 * 展示所有已退休宠物的纪念页，让"退休循环"有温度地收尾
 * 记忆日记：翻看每只退休宠物还记得的主人往事（记忆可查看是差异化信任特性）
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
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

interface MemoryItem {
  id: number;
  content: string;
  created_at: string;
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

// ============================================================
// 记忆日记弹窗
// ============================================================

function MemoryDiaryModal({
  visible,
  pet,
  onClose,
}: {
  visible: boolean;
  pet: RetiredPet | null;
  onClose: () => void;
}) {
  const [memories, setMemories] = useState<MemoryItem[] | null>(null);

  React.useEffect(() => {
    if (!visible || !pet) return;
    setMemories(null);
    (async () => {
      try {
        const result = await apiFetch<{ memories: MemoryItem[] }>(`/ai/memories/${pet.id}?limit=50`);
        setMemories(result.memories);
      } catch {
        setMemories([]);
      }
    })();
  }, [visible, pet]);

  if (!pet) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.diaryContainer}>
        <View style={styles.diaryHeader}>
          <Text style={styles.diaryTitle}>📖 {pet.name}的记忆日记</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.diaryClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {memories === null ? (
          <View style={styles.diaryLoading}>
            <ActivityIndicator size="large" color="#FF9F43" />
            <Text style={styles.diaryLoadingText}>翻阅回忆中...</Text>
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.diaryEmpty}>
            <Text style={styles.diaryEmptyEmoji}>💭</Text>
            <Text style={styles.diaryEmptyTitle}>{pet.name}没有留下记忆</Text>
            <Text style={styles.diaryEmptyDesc}>聊天中说过的事（名字、喜好、叮嘱）会记录在这里</Text>
          </View>
        ) : (
          <ScrollView style={styles.diaryList} contentContainerStyle={styles.diaryListContent}>
            <Text style={styles.diaryCount}>它一共记得 {memories.length} 件关于你的事</Text>
            {memories.map((m, idx) => (
              <View key={m.id} style={styles.memoryCard}>
                <View style={styles.memoryHeader}>
                  <Text style={styles.memoryIndex}>#{memories.length - idx}</Text>
                  <Text style={styles.memoryDate}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : ''}
                  </Text>
                </View>
                <Text style={styles.memoryContent}>{m.content}</Text>
              </View>
            ))}
            <Text style={styles.diaryFooter}>—— 这些回忆只属于你们 ——</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function ArchiveScreen() {
  const [pets, setPets] = useState<RetiredPet[] | null>(null);
  const [diaryPet, setDiaryPet] = useState<RetiredPet | null>(null);

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
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.diaryBtn} onPress={() => setDiaryPet(pet)}>
                  <Text style={styles.diaryBtnText}>📖 记忆日记</Text>
                </TouchableOpacity>
                <Text style={styles.retiredBadge}>🌟 荣誉退休</Text>
              </View>
            </View>
          );
        })
      )}

      <MemoryDiaryModal visible={!!diaryPet} pet={diaryPet} onClose={() => setDiaryPet(null)} />
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
  cardActions: { alignItems: 'flex-end', gap: 8 },
  diaryBtn: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  diaryBtnText: { fontSize: 12, fontWeight: '600', color: '#5A7A6A' },
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

  // 记忆日记弹窗
  diaryContainer: { flex: 1, backgroundColor: '#FFF5F7' },
  diaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  diaryTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  diaryClose: { fontSize: 18, color: '#999' },
  diaryLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  diaryLoadingText: { fontSize: 13, color: '#999', marginTop: 12 },
  diaryEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  diaryEmptyEmoji: { fontSize: 48, marginBottom: 12 },
  diaryEmptyTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A', marginBottom: 6 },
  diaryEmptyDesc: { fontSize: 13, color: '#999', textAlign: 'center', lineHeight: 19 },
  diaryList: { flex: 1 },
  diaryListContent: { padding: 20 },
  diaryCount: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 16 },
  memoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  memoryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  memoryIndex: { fontSize: 11, fontWeight: '700', color: '#FF9F43' },
  memoryDate: { fontSize: 11, color: '#CCC' },
  memoryContent: { fontSize: 14, color: '#5A4A4A', lineHeight: 20 },
  diaryFooter: { fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 8 },
});
