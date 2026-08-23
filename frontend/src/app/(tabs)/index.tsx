/**
 * 帽子AI宠物 - 首页（宠物主界面）
 * 80% 区域展示宠物，底部 Tab 导航
 * 修复：页面获得焦点时自动刷新宠物数据
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { usePetStore, INTERACTION_LABELS } from '../../store/petStore';
import { clearToken } from '../../config/env';

const { width } = Dimensions.get('window');

// ============================================================
// 子组件
// ============================================================

function PetAvatar({ stage, mood }: { stage: string; mood: number }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const getPetEmoji = () => {
    if (stage === 'egg') return '🥚';
    if (mood < 30) return '😿';
    if (stage === 'adult') return '😺';
    if (stage === 'teen') return '🐱';
    return '🐱';
  };

  return (
    <Animated.View style={[styles.petContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.petEmoji}>{getPetEmoji()}</Text>
      {stage === 'egg' && <Text style={styles.stageHint}>点击孵化 ✨</Text>}
    </Animated.View>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarBg}>
        <View style={[styles.statBarFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.statValue}>{Math.round(value)}</Text>
    </View>
  );
}

function InteractionButton({ action, icon, onPress }: { action: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{INTERACTION_LABELS[action] || action}</Text>
    </TouchableOpacity>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>⚠️ {message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.errorDismiss}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function HomeScreen() {
  const router = useRouter();
  const {
    pet, isLoading, isInteracting, error, user,
    todayEvent, fetchPet, interact, clearEvent, clearError,
  } = usePetStore();

  const [interactMessage, setInteractMessage] = useState('');

  // 退出登录
  const handleLogout = async () => {
    await clearToken();
    router.replace('/login');
  };

  // 每次页面获得焦点时刷新宠物数据（解决孵化后不更新问题）
  useFocusEffect(
    useCallback(() => {
      fetchPet();
    }, [])
  );

  const handleInteract = async (action: 'feed' | 'clean' | 'play' | 'comfort' | 'pet') => {
    const message = await interact(action);
    setInteractMessage(message);
    setTimeout(() => setInteractMessage(''), 3000);
  };

  // 加载中
  if (isLoading && !pet) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF9F43" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  // 没有宠物 → 引导孵化
  if (!pet) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyEmoji}>🥚</Text>
        <Text style={styles.emptyTitle}>还没有宠物哦~</Text>
        <Text style={styles.emptySubtitle}>孵化你的第一只 AI 小猫吧</Text>
        <Link href="/onboarding" asChild>
          <TouchableOpacity style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>🎁 开始孵化</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 错误提示 */}
      {error && <ErrorBanner message={error} onDismiss={clearError} />}

      {/* 用户信息 */}
      {user && (
        <View style={styles.userBar}>
          <Text style={styles.userText}>👤 {user.nickname}</Text>
          <View style={styles.userRight}>
            <Text style={styles.currencyText}>🪙 {user.coins}</Text>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>退出</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 宠物名称 + 阶段标签 */}
      <View style={styles.header}>
        <Text style={styles.petName}>{pet.name}</Text>
        <View style={styles.stageTag}>
          <Text style={styles.stageTagText}>
            {pet.stage === 'egg' ? '宠物蛋' : pet.stage === 'child' ? '幼体' : pet.stage === 'teen' ? '少年' : '成年'} Lv.{pet.level}
          </Text>
        </View>
      </View>

      {/* 随机事件提示 */}
      {todayEvent && (
        <TouchableOpacity style={styles.eventBanner} onPress={clearEvent}>
          <Text style={styles.eventText}>✨ {todayEvent}</Text>
        </TouchableOpacity>
      )}

      {/* 宠物展示区 */}
      <PetAvatar stage={pet.stage} mood={pet.stats.mood} />

      {/* 互动反馈消息 */}
      {interactMessage ? (
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>{interactMessage}</Text>
        </View>
      ) : null}

      {/* 互动按钮 */}
      <View style={styles.actionRow}>
        <InteractionButton action="feed" icon="🍖" onPress={() => handleInteract('feed')} />
        <InteractionButton action="clean" icon="🛁" onPress={() => handleInteract('clean')} />
        <InteractionButton action="play" icon="🎾" onPress={() => handleInteract('play')} />
        <InteractionButton action="comfort" icon="💕" onPress={() => handleInteract('comfort')} />
        <InteractionButton action="pet" icon="✋" onPress={() => handleInteract('pet')} />
      </View>

      {/* 属性面板 */}
      <View style={styles.statsPanel}>
        <Text style={styles.statsTitle}>状态</Text>
        <StatBar label="🍖 饥饿" value={pet.stats.hunger} color="#FF9F43" />
        <StatBar label="🧼 清洁" value={pet.stats.cleanliness} color="#54A0FF" />
        <StatBar label="😊 心情" value={pet.stats.mood} color="#FECA57" />
        <StatBar label="⚡ 体力" value={pet.stats.energy} color="#5F27CD" />
        <StatBar label="❤️ 健康" value={pet.stats.health} color="#FF6B6B" />
      </View>
    </ScrollView>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' },
  loadingText: { fontSize: 14, color: '#999', marginTop: 12 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F0',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
  },
  errorText: { flex: 1, fontSize: 13, color: '#C0392B' },
  errorDismiss: { fontSize: 14, color: '#999', paddingLeft: 8 },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  userText: { fontSize: 14, color: '#777' },
  userRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currencyText: { fontSize: 14, color: '#FF9F43', fontWeight: '600' },
  logoutBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#F0F0F0' },
  logoutText: { fontSize: 12, color: '#999' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  petName: { fontSize: 28, fontWeight: '700', color: '#5A4A4A' },
  stageTag: { backgroundColor: '#FECA57', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stageTagText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  eventBanner: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FECA57',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  eventText: { fontSize: 13, color: '#8B7000' },
  petContainer: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  petEmoji: { fontSize: 100 },
  stageHint: { fontSize: 14, color: '#999', marginTop: 8 },
  messageBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  messageText: { fontSize: 14, color: '#5A4A4A', textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 10, marginVertical: 20, flexWrap: 'wrap', justifyContent: 'center' },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 10, color: '#999', marginTop: 2 },
  statsPanel: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  statsTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A', marginBottom: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statLabel: { width: 70, fontSize: 13, color: '#777' },
  statBarBg: { flex: 1, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  statBarFill: { height: '100%', borderRadius: 4 },
  statValue: { width: 30, fontSize: 12, color: '#999', textAlign: 'right' },
  emptyEmoji: { fontSize: 80, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#5A4A4A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#999', marginBottom: 30 },
  primaryBtn: {
    backgroundColor: '#FF9F43',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    ...Platform.select({
      ios: { shadowColor: '#FF9F43', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
