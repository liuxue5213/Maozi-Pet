/**
 * 帽子AI宠物 - 首页（宠物主界面）
 * 80% 区域展示宠物，底部 Tab 导航
 * 修复：页面获得焦点时自动刷新宠物数据
 */
import React, { useState, useCallback, useEffect } from 'react';
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
  Modal,
  TextInput,
} from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { usePetStore, INTERACTION_LABELS } from '../../store/petStore';
import { useInventoryStore } from '../../store/inventoryStore';
import { apiFetch } from '../../config/env';
import { SKIN_RING_COLORS, DEFAULT_SKIN_RING, equippedItemId } from '../../config/appearance';
import { useRef } from 'react';

const { width } = Dimensions.get('window');

// 与后端 pet.ts 的升级曲线保持一致：每级需要 level * 20 经验
function expToNextLevel(level: number): number {
  return level * 20;
}

// 猜拳选项（与后端 rps.ts 对齐）
const RPS_HANDS = [
  { choice: 'rock', emoji: '✊', label: '石头' },
  { choice: 'paper', emoji: '✋', label: '布' },
  { choice: 'scissors', emoji: '✌️', label: '剪刀' },
] as const;
const RPS_EMOJI: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const RPS_RESULT_TEXT: Record<string, { text: string; color: string }> = {
  win: { text: '🏆 你赢了！', color: '#5A7A6A' },
  lose: { text: '😹 帽子赢了', color: '#FF9F43' },
  draw: { text: '🤝 平局', color: '#54A0FF' },
};

interface RpsRound {
  result: 'win' | 'lose' | 'draw';
  petChoice: string;
  message: string;
  coinReward: number;
  playsLeft: number;
}

// 猜数字小游戏状态
interface GuessState {
  sessionId: number;
  attemptsUsed: number;
  attemptsLeft: number;
  maxAttempts: number;
  history: { text: string; type: 'hint-up' | 'hint-down' | 'info' }[];
  finished: boolean;
}

interface DailyTask {
  taskId: string;
  title: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
  done: boolean;
}

// ============================================================
// 子组件
// ============================================================

interface EquippedItem {
  slot: string;
  itemId: string;
  name: string;
  icon: string;
  category: string;
}

// 已装备物品在宠物圆盘上的摆放位置（按槽位）
// skin/frame/bubble 不在此渲染：skin → 圆盘描边色，frame → 个人头像描边，bubble → 聊天气泡配色
const EQUIP_POSITIONS: Record<string, { top?: number; bottom?: number; left?: number; right?: number }> = {
  hat: { top: 8, right: 18 },
  clothing: { bottom: 10, left: 18 },
  accessory: { bottom: 24, right: 12 },
  effect: { top: 28, left: 14 },
};

// 情绪外显：按状态优先级决定宠物表情（睡觉 > 心情 > 饥饿 > 清洁 > 体力）
function moodState(stats: { hunger: number; cleanliness: number; mood: number; energy: number }): { emoji: string; hint: string } | null {
  if (stats.mood < 30) return { emoji: '😿', hint: '它心情低落，陪它玩玩吧' };
  if (stats.hunger < 30) return { emoji: '😾', hint: '它的肚子咕咕叫了，喂点吃的吧' };
  if (stats.cleanliness < 30) return { emoji: '🙀', hint: '它身上脏脏的，洗个澡吧' };
  if (stats.energy < 25) return { emoji: '😪', hint: '它困了，哄它睡一觉吧' };
  return null;
}

function PetAvatar({ stage, stats, equips, isSleeping }: { stage: string; stats: { hunger: number; cleanliness: number; mood: number; energy: number }; equips: EquippedItem[]; isSleeping: boolean }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 情绪外显：低状态表情 + 互动引导语（蛋/睡觉除外）
  const state = stage !== 'egg' && !isSleeping ? moodState(stats) : null;

  const getPetEmoji = () => {
    if (stage === 'egg') return '🥚';
    if (isSleeping) return '😴';
    if (state) return state.emoji;
    if (stage === 'adult') return '😺';
    return '🐱';
  };

  // 皮肤装备 → 圆盘描边换色（买来的花色看得见）
  const skinItemId = equippedItemId(equips, 'skin');
  const skinRing = (skinItemId && SKIN_RING_COLORS[skinItemId]) || DEFAULT_SKIN_RING;

  return (
    <Animated.View
      style={[
        styles.petContainer,
        { transform: [{ scale: scaleAnim }] },
        skinItemId ? styles.petContainerSkinned : null,
        skinItemId ? { borderColor: skinRing } : null,
      ]}
    >
      <Text style={styles.petEmoji}>{getPetEmoji()}</Text>
      {/* 睡觉状态：头顶飘 💤 */}
      {isSleeping && stage !== 'egg' && (
        <Text style={[styles.equipIcon, EQUIP_POSITIONS.hat]}>💤</Text>
      )}
      {/* 渲染已装备的装扮（只画有坐标的槽位，避免未知槽位叠在头饰位置） */}
      {equips.filter(e => EQUIP_POSITIONS[e.slot] && !(isSleeping && e.slot === 'hat')).map(e => (
        <Text key={e.slot} style={[styles.equipIcon, EQUIP_POSITIONS[e.slot]]}>
          {e.icon}
        </Text>
      ))}
      {stage === 'egg' && <Text style={styles.stageHint}>点击孵化 ✨</Text>}
      {isSleeping && stage !== 'egg' && <Text style={styles.stageHint}>Zzz… 睡得正香</Text>}
      {state && <Text style={styles.stageHint}>{state.hint}</Text>}
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

function InteractionButton({ action, icon, onPress, disabled }: { action: string; icon: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
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

// 猜拳小游戏弹窗（赢+金币+心情，输也+心情：低压力，不惩罚）
function RpsModal({
  visible,
  onClose,
  petName,
}: {
  visible: boolean;
  onClose: () => void;
  petName: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState<RpsRound | null>(null);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handlePlay = async (choice: 'rock' | 'paper' | 'scissors') => {
    setPlaying(true);
    setError('');
    try {
      const result = await apiFetch<RpsRound & { pet: any; totalCoins: number }>(
        `/pet/${usePetStore.getState().pet?.id}/rps`,
        { method: 'POST', body: JSON.stringify({ choice }) },
      );
      setRound(result);
      setMyChoice(choice);
      usePetStore.getState().updateCoins(result.totalCoins);
      await usePetStore.getState().fetchPet();
    } catch (err: any) {
      setError(err.message || '出错了，再试一次喵');
    } finally {
      setPlaying(false);
    }
  };

  const handleClose = () => {
    setRound(null);
    setMyChoice(null);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.rpsContainer}>
        <View style={styles.rpsHeader}>
          <Text style={styles.rpsTitle}>🎮 和{petName}猜拳</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.rpsClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rpsArena}>
          {/* 帽子的出拳 */}
          <View style={styles.rpsHandBox}>
            <Text style={styles.rpsHand}>{round ? RPS_EMOJI[round.petChoice] : '🐱'}</Text>
            <Text style={styles.rpsHandLabel}>{petName}</Text>
          </View>

          <Text style={styles.rpsVs}>VS</Text>

          {/* 我的出拳 */}
          <View style={styles.rpsHandBox}>
            <Text style={styles.rpsHand}>{myChoice ? RPS_EMOJI[myChoice] : '🙋'}</Text>
            <Text style={styles.rpsHandLabel}>你</Text>
          </View>
        </View>

        {/* 结果 */}
        {round && (
          <View style={styles.rpsResultBox}>
            <Text style={[styles.rpsResultText, { color: RPS_RESULT_TEXT[round.result].color }]}>
              {RPS_RESULT_TEXT[round.result].text}
            </Text>
            <Text style={styles.rpsMessage}>{round.message}</Text>
            {round.playsLeft <= 3 && <Text style={styles.rpsPlaysLeft}>今日还能玩 {round.playsLeft} 局</Text>}
          </View>
        )}
        {error.length > 0 && <Text style={styles.rpsError}>{error}</Text>}

        {/* 出拳按钮 */}
        <View style={styles.rpsChoices}>
          {RPS_HANDS.map(h => (
            <TouchableOpacity
              key={h.choice}
              style={styles.rpsChoiceBtn}
              disabled={playing}
              onPress={() => handlePlay(h.choice)}
              activeOpacity={0.7}
            >
              <Text style={styles.rpsChoiceEmoji}>{h.emoji}</Text>
              <Text style={styles.rpsChoiceLabel}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.rpsRule}>赢 +🪙10 ⬆️心情 · 输也 +心情（不惩罚）· 每日 20 局</Text>
      </View>
    </Modal>
  );
}

// 猜数字小游戏弹窗（帽子想一个 1~100 的数；每局+心情，赢了+金币，输了不惩罚）
function GuessModal({
  visible,
  onClose,
  petName,
}: {
  visible: boolean;
  onClose: () => void;
  petName: string;
}) {
  const [game, setGame] = useState<GuessState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const petId = usePetStore.getState().pet?.id;

  const startGame = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<{
        sessionId: number; attemptsUsed: number; attemptsLeft: number; maxAttempts: number; resumed: boolean; message: string;
      }>(`/pet/${petId}/guess/start`, { method: 'POST' });
      setGame({
        sessionId: result.sessionId,
        attemptsUsed: result.attemptsUsed,
        attemptsLeft: result.attemptsLeft,
        maxAttempts: result.maxAttempts,
        history: [{ text: result.message, type: 'info' }],
        finished: false,
      });
      setInput('');
    } catch (err: any) {
      setError(err.message || '开局失败，再试一次喵');
    } finally {
      setBusy(false);
    }
  };

  // 打开弹窗自动开局
  useEffect(() => {
    if (visible && !game) startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleGuess = async () => {
    if (!game || busy) return;
    const n = parseInt(input, 10);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError('请输入 1~100 的整数');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<{
        result: 'higher' | 'lower' | 'correct' | 'lost';
        attemptsUsed?: number;
        attemptsLeft?: number;
        secret?: number;
        pet?: any;
        coinReward?: number;
        totalCoins?: number;
        message: string;
      }>(`/pet/${petId}/guess`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: game.sessionId, number: n }),
      });

      if (result.result === 'correct') {
        setGame(g => g ? {
          ...g,
          finished: true,
          history: [...g.history, { text: result.message, type: 'info' }],
        } : g);
        if (typeof result.totalCoins === 'number') usePetStore.getState().updateCoins(result.totalCoins);
        await usePetStore.getState().fetchPet();
      } else if (result.result === 'lost') {
        // 次数用完：不惩罚（仍 +心情），公布谜底
        setGame(g => g ? {
          ...g,
          finished: true,
          attemptsLeft: 0,
          history: [...g.history, { text: result.message, type: 'info' }],
        } : g);
      } else {
        setGame(g => g ? {
          ...g,
          attemptsUsed: result.attemptsUsed ?? g.attemptsUsed,
          attemptsLeft: result.attemptsLeft ?? g.attemptsLeft,
          history: [...g.history, { text: result.message, type: result.result === 'higher' ? 'hint-up' : 'hint-down' }],
        } : g);
        // 用满次数 = 落败（不惩罚，仍 +心情），结束本局
        if ((result.attemptsLeft ?? 1) <= 0) {
          setGame(g => g ? { ...g, finished: true } : g);
        }
      }
      setInput('');
    } catch (err: any) {
      setError(err.message || '出错了，再试一次喵');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setGame(null);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.rpsContainer}>
        <View style={styles.rpsHeader}>
          <Text style={styles.rpsTitle}>🔢 和{petName}玩猜数字</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.rpsClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 开局失败也要让错误可见（game 为 null 时不再白屏弹窗） */}
        {!game && (
          <View style={styles.guessHistory}>
            <Text style={styles.guessHistoryText}>{error || '正在开局…'}</Text>
            <TouchableOpacity style={[styles.guessBtn, styles.guessRetryBtn]} onPress={startGame} disabled={busy}>
              <Text style={styles.guessBtnText}>{busy ? '...' : '🔄 重试'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {game && (
          <>
            {/* 剩余次数 */}
            <Text style={styles.guessAttempts}>
              剩余机会 {'❤️'.repeat(Math.max(0, game.attemptsLeft))}{'🤍'.repeat(Math.max(0, game.maxAttempts - game.attemptsLeft))}
            </Text>

            {/* 提示历史 */}
            <View style={styles.guessHistory}>
              {game.history.map((h, i) => (
                <Text key={i} style={styles.guessHistoryText}>{h.text}</Text>
              ))}
            </View>

            {error.length > 0 && <Text style={styles.rpsError}>{error}</Text>}

            {/* 输入 + 猜 */}
            {!game.finished ? (
              <View style={styles.guessInputRow}>
                <TextInput
                  style={styles.guessInput}
                  value={input}
                  onChangeText={setInput}
                  placeholder="1~100"
                  placeholderTextColor="#CCC"
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <TouchableOpacity style={styles.guessBtn} onPress={handleGuess} disabled={busy}>
                  <Text style={styles.guessBtnText}>{busy ? '...' : '猜！'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.guessBtn} onPress={startGame} disabled={busy}>
                <Text style={styles.guessBtnText}>{busy ? '...' : '🔄 再来一局'}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.rpsRule}>猜对 +🪙10~20（越快越多）· 猜不中也 +心情 · 每日 5 局</Text>
          </>
        )}
      </View>
    </Modal>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function HomeScreen() {
  const router = useRouter();
  const {
    pet, isLoading, isInteracting, error, user,
    todayEvent, fetchPet, interact, clearEvent, clearError, logout, fetchUser, fetchTodayEvent,
    sleepPet, wakePet,
  } = usePetStore();
  const {
    currentScene, equips, fetchEquips: fetchPetEquips, fetchScenes,
  } = useInventoryStore();

  const [interactMessage, setInteractMessage] = useState('');
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [rpsVisible, setRpsVisible] = useState(false);
  const [guessVisible, setGuessVisible] = useState(false);
  const [retireVisible, setRetireVisible] = useState(false);
  const [retireBusy, setRetireBusy] = useState(false);
  const eventAttempted = useRef(false); // 每次进入 app 只尝试拉取一次随机事件

  // 每日任务：拉取 + 领取（金币即时同步到全局用户状态）
  const loadTasks = useCallback(async () => {
    try {
      const result = await apiFetch<{ tasks: DailyTask[] }>('/tasks/daily');
      setTasks(result.tasks);
    } catch {
      // 任务是辅助功能，静默失败
    }
  }, []);

  const handleClaimTask = async (taskId: string) => {
    try {
      const result = await apiFetch<{ message: string; reward: number; totalCoins: number }>(
        `/tasks/daily/${taskId}/claim`, { method: 'POST' });
      usePetStore.getState().updateCoins(result.totalCoins);
      setInteractMessage(result.message);
      setTimeout(() => setInteractMessage(''), 3000);
      loadTasks();
    } catch (err: any) {
      setInteractMessage(err.message || '领取失败');
      setTimeout(() => setInteractMessage(''), 3000);
    }
  };

  // 退出登录（清除 Token + 重置全局状态）
  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // 光荣退休：确认后调用后端，宠物入驻档案馆，回到孵化引导
  const handleRetire = async () => {
    if (!pet || retireBusy) return;
    setRetireBusy(true);
    try {
      const result = await apiFetch<{ message: string }>(`/pet/${pet.id}/retire`, { method: 'POST' });
      setRetireVisible(false);
      setInteractMessage(result.message);
      setTimeout(() => setInteractMessage(''), 4000);
      await fetchPet();
    } catch (err: any) {
      setInteractMessage(err.message || '退休失败，请稍后再试');
      setTimeout(() => setInteractMessage(''), 3000);
    } finally {
      setRetireBusy(false);
    }
  };

  // 页面获得焦点时：刷新宠物 + 恢复用户信息 + 同步装扮/场景数据
  // 孵化、购买、换装后回到首页都会走这里
  useFocusEffect(
    useCallback(() => {
      (async () => {
        await fetchPet();
        // 宠物就绪后再拉取装备（需要 petId）
        const currentPet = usePetStore.getState().pet;
        if (currentPet) fetchPetEquips(currentPet.id);
      })();
      fetchUser();
      fetchScenes();
      loadTasks();
      if (!eventAttempted.current) {
        eventAttempted.current = true;
        fetchTodayEvent();
      }
    }, [])
  );

  const handleInteract = async (action: 'feed' | 'clean' | 'play' | 'comfort' | 'pet') => {
    const message = await interact(action);
    setInteractMessage(message);
    setTimeout(() => setInteractMessage(''), 3000);
    // 互动会推进每日任务进度，即时刷新任务卡片（补强：原先只在页面聚焦时拉取）
    loadTasks();
  };

  // 哄睡 / 叫醒（作息循环：睡觉回体力，醒来精神满满）
  const isSleeping = !!pet?.isSleeping;
  const handleSleepToggle = async () => {
    if (!pet) return;
    const message = isSleeping ? await wakePet() : await sleepPet();
    setInteractMessage(message);
    setTimeout(() => setInteractMessage(''), 4000);
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
        <Link href="/archive" asChild>
          <TouchableOpacity style={styles.archiveLink}>
            <Text style={styles.archiveLinkText}>🏛️ 想念它们？去宠物档案馆看看</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  // 家园场景背景（商城购买场景后在此生效）
  const sceneBg = currentScene?.backgroundColor || '#FFF5F7';

  return (
    <ScrollView style={[styles.container, { backgroundColor: sceneBg }]} contentContainerStyle={styles.content}>
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
      <PetAvatar stage={pet.stage} stats={pet.stats} equips={equips} isSleeping={isSleeping} />

      {/* 互动反馈消息 */}
      {interactMessage ? (
        <View style={styles.messageBubble}>
          <Text style={styles.messageText}>{interactMessage}</Text>
        </View>
      ) : null}

      {/* 互动按钮（睡觉时禁用日常互动，只留叫醒） */}
      <View style={styles.actionRow}>
        {(['feed', 'clean', 'play', 'comfort', 'pet'] as const).map(action => (
          <InteractionButton
            key={action}
            action={action}
            icon={{ feed: '🍖', clean: '🛁', play: '🎾', comfort: '💕', pet: '✋' }[action]}
            onPress={() => handleInteract(action)}
            disabled={isSleeping}
          />
        ))}
        {/* 蛋阶段不会猜拳，成年玩法；睡觉时不玩 */}
        {pet.stage !== 'egg' && !isSleeping && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setRpsVisible(true)} activeOpacity={0.7}>
              <Text style={styles.actionIcon}>🎮</Text>
              <Text style={styles.actionLabel}>猜拳</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setGuessVisible(true)} activeOpacity={0.7}>
              <Text style={styles.actionIcon}>🔢</Text>
              <Text style={styles.actionLabel}>猜数字</Text>
            </TouchableOpacity>
          </>
        )}
        {/* 作息入口：哄睡 / 叫醒（蛋不需要睡觉） */}
        {pet.stage !== 'egg' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.sleepBtn]}
            onPress={handleSleepToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>{isSleeping ? '☀️' : '🌙'}</Text>
            <Text style={styles.actionLabel}>{isSleeping ? '叫醒' : '哄睡'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 猜拳小游戏 */}
      <RpsModal
        visible={rpsVisible}
        onClose={() => setRpsVisible(false)}
        petName={pet.name}
      />

      {/* 猜数字小游戏 */}
      <GuessModal
        visible={guessVisible}
        onClose={() => setGuessVisible(false)}
        petName={pet.name}
      />

      {/* 每日任务 */}
      {tasks.length > 0 && (
        <View style={styles.statsPanel}>
          <Text style={styles.statsTitle}>📋 每日任务</Text>
          {tasks.map(t => (
            <View key={t.taskId} style={styles.taskRow}>
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{t.title}</Text>
                <Text style={styles.taskProgressText}>
                  {t.claimed ? '已领取' : `进度 ${t.progress}/${t.target}`} · 🪙+{t.reward}
                </Text>
              </View>
              {t.claimed ? (
                <Text style={styles.taskClaimed}>✓</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.taskClaimBtn, !t.done && styles.taskClaimBtnDisabled]}
                  disabled={!t.done}
                  onPress={() => handleClaimTask(t.taskId)}
                >
                  <Text style={[styles.taskClaimText, !t.done && styles.taskClaimTextDisabled]}>
                    {t.done ? '领取' : '进行中'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* 成就徽章入口 */}
      <Link href="/achievements" asChild>
        <TouchableOpacity style={styles.achievementEntry}>
          <Text style={styles.achievementEntryText}>🏆 成就徽章墙</Text>
        </TouchableOpacity>
      </Link>

      {/* 属性面板 */}
      <View style={styles.statsPanel}>
        <Text style={styles.statsTitle}>状态</Text>
        {/* 升级进度条 */}
        <View style={styles.expRow}>
          <Text style={styles.expLabel}>Lv.{pet.level}</Text>
          <View style={styles.expBarBg}>
            <View
              style={[
                styles.expBarFill,
                {
                  width: `${Math.min(100, Math.round((pet.exp / expToNextLevel(pet.level)) * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.expValue}>
            {pet.exp}/{expToNextLevel(pet.level)}
          </Text>
        </View>
        <StatBar label="🍖 饥饿" value={pet.stats.hunger} color="#FF9F43" />
        <StatBar label="🧼 清洁" value={pet.stats.cleanliness} color="#54A0FF" />
        <StatBar label="😊 心情" value={pet.stats.mood} color="#FECA57" />
        <StatBar label="⚡ 体力" value={pet.stats.energy} color="#5F27CD" />
        <StatBar label="❤️ 健康" value={pet.stats.health} color="#FF6B6B" />
        {/* 成年宠物：退休循环入口（退休≠死亡：入驻档案馆，记忆日记永久保存） */}
        {pet.stage === 'adult' && (
          <TouchableOpacity style={styles.retireEntry} onPress={() => setRetireVisible(true)}>
            <Text style={styles.retireEntryText}>🎓 让{pet.name}光荣退休，入驻档案馆</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 退休确认弹窗 */}
      <Modal visible={retireVisible} transparent animationType="fade">
        <View style={styles.retireOverlay}>
          <View style={styles.retireDialog}>
            <Text style={styles.retireTitle}>🎓 光荣退休</Text>
            <Text style={styles.retireBody}>
              {pet.name}将结束成长之旅，入驻宠物档案馆{'\n'}
              · 它的记忆日记会永久保存{'\n'}
              · 退休后可以孵化新的宠物蛋{'\n'}
              · 此操作不可撤销
            </Text>
            <View style={styles.retireBtns}>
              <TouchableOpacity
                style={styles.retireCancelBtn}
                disabled={retireBusy}
                onPress={() => setRetireVisible(false)}
              >
                <Text style={styles.retireCancelText}>再陪陪它</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retireConfirmBtn, retireBusy && styles.retireBtnDisabled]}
                disabled={retireBusy}
                onPress={handleRetire}
              >
                <Text style={styles.retireConfirmText}>{retireBusy ? '办理中...' : '光荣退休'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  petContainerSkinned: { borderWidth: 6 },
  equipIcon: {
    position: 'absolute',
    fontSize: 26,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
  actionBtnDisabled: { opacity: 0.35 },
  sleepBtn: { backgroundColor: '#EDE8FF' },
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0F0',
  },
  taskInfo: { flex: 1, paddingRight: 8 },
  taskTitle: { fontSize: 14, color: '#5A4A4A', fontWeight: '500' },
  taskProgressText: { fontSize: 12, color: '#BBB', marginTop: 2 },
  taskClaimBtn: {
    backgroundColor: '#FF9F43',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  taskClaimBtnDisabled: { backgroundColor: '#EEE' },
  taskClaimText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  taskClaimTextDisabled: { color: '#BBB' },
  taskClaimed: { fontSize: 16, color: '#5A7A6A', paddingHorizontal: 10 },
  expRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  expLabel: { width: 44, fontSize: 13, fontWeight: '700', color: '#FF9F43' },
  expBarBg: { flex: 1, height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden', marginHorizontal: 8 },
  expBarFill: { height: '100%', backgroundColor: '#FF9F43', borderRadius: 5 },
  expValue: { width: 56, fontSize: 11, color: '#999', textAlign: 'right' },
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
  archiveLink: { marginTop: 20, paddingVertical: 6 },
  archiveLinkText: { fontSize: 13, color: '#BBB' },
  achievementEntry: {
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  achievementEntryText: { fontSize: 13, fontWeight: '600', color: '#B8860B' },

  // 退休入口 + 确认弹窗
  retireEntry: {
    marginTop: 12,
    backgroundColor: '#F5F0FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  retireEntryText: { fontSize: 12, fontWeight: '600', color: '#5F27CD' },
  retireOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  retireDialog: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  retireTitle: { fontSize: 18, fontWeight: '700', color: '#5A4A4A', textAlign: 'center', marginBottom: 12 },
  retireBody: { fontSize: 13, color: '#777', lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  retireBtns: { flexDirection: 'row', gap: 12 },
  retireCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  retireCancelText: { fontSize: 14, color: '#777', fontWeight: '600' },
  retireConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#5F27CD',
    alignItems: 'center',
  },
  retireConfirmText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  retireBtnDisabled: { opacity: 0.6 },

  // 猜拳小游戏弹窗
  rpsContainer: { flex: 1, backgroundColor: '#FFF5F7', alignItems: 'center' },
  rpsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rpsTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  rpsClose: { fontSize: 18, color: '#999' },
  rpsArena: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    marginTop: 48,
    marginBottom: 24,
  },
  rpsHandBox: { alignItems: 'center' },
  rpsHand: { fontSize: 64 },
  rpsHandLabel: { fontSize: 13, color: '#999', marginTop: 6 },
  rpsVs: { fontSize: 20, fontWeight: '700', color: '#FF9F43' },
  rpsResultBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 90,
    justifyContent: 'center',
    width: '86%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  rpsResultText: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  rpsMessage: { fontSize: 14, color: '#5A4A4A', textAlign: 'center' },
  rpsPlaysLeft: { fontSize: 11, color: '#BBB', marginTop: 6 },
  rpsError: { fontSize: 13, color: '#C0392B', marginBottom: 16 },
  rpsChoices: { flexDirection: 'row', gap: 18 },
  rpsChoiceBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  rpsChoiceEmoji: { fontSize: 34 },
  rpsChoiceLabel: { fontSize: 12, color: '#777', marginTop: 2 },
  rpsRule: { fontSize: 11, color: '#BBB', marginTop: 24, textAlign: 'center', paddingHorizontal: 24 },

  // 猜数字小游戏弹窗
  guessAttempts: { fontSize: 14, marginTop: 32, marginBottom: 12, color: '#5A4A4A' },
  guessHistory: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '86%',
    minHeight: 100,
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  guessHistoryText: { fontSize: 14, color: '#5A4A4A', lineHeight: 24, textAlign: 'center' },
  guessInputRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  guessInput: {
    width: 120,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#FF9F43',
    textAlign: 'center',
  },
  guessBtn: {
    backgroundColor: '#FF9F43',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  guessRetryBtn: { alignSelf: 'center', marginTop: 12 },
  guessBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
