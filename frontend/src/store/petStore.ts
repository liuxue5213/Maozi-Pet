/**
 * 帽子AI宠物 - 宠物状态管理（持久化 + JWT 鉴权版）
 */
import { create } from 'zustand';
import { apiFetch, clearToken } from '../config/env';

// ============================================================
// 类型
// ============================================================

export type Personality = 'cute' | 'tsundere' | 'funny' | 'calm' | 'cool';
export type GrowthStage = 'egg' | 'child' | 'teen' | 'adult';

export interface PetStats {
  hunger: number;
  cleanliness: number;
  mood: number;
  energy: number;
  health: number;
}

export interface Pet {
  id: string;
  name: string;
  personality: Personality;
  stage: GrowthStage;
  level: number;
  exp: number;
  stats: PetStats;
  appearance: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  totalInteractions: number;
  isRetired: boolean;
  isSleeping?: boolean;
  sleepStartedAt?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** 本地占位消息（网络失败兜底），不会作为上下文发送给 AI */
  isLocal?: boolean;
}

/** 宠物记忆（GET /ai/memories/:petId 返回结构） */
export interface PetMemory {
  id: number;
  content: string;
  created_at: string;
}

export interface UserInfo {
  id: string;
  type: 'guest' | 'registered';
  nickname: string;
  avatarEmoji?: string;
  privacy?: { showOnSquare: boolean; allowStrangerInteract: boolean; hidePetInfo: boolean };
  coins: number;
  diamonds: number;
}

// ============================================================
// 互动标签
// ============================================================

export const INTERACTION_LABELS: Record<string, string> = {
  feed: '喂食',
  clean: '清洁',
  play: '玩耍',
  comfort: '安抚',
  pet: '摸摸',
};

// ============================================================
// Store
// ============================================================

interface PetState {
  // 用户
  user: UserInfo | null;
  isLoggedIn: boolean;

  // 宠物
  pet: Pet | null;
  isLoading: boolean;
  isInteracting: boolean;
  error: string | null;

  // 聊天
  chatHistory: ChatMessage[];
  todayEvent: string | null;

  // 记忆
  memories: PetMemory[];
  memoriesLoading: boolean;

  // --- Auth Actions ---
  setAuth: (user: UserInfo) => void;
  updateCoins: (coins: number) => void;
  updateDiamonds: (diamonds: number) => void;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;

  // --- Pet Actions ---
  createPet: (name: string, personality: Personality) => Promise<void>;
  fetchPet: () => Promise<void>;
  interact: (action: 'feed' | 'clean' | 'play' | 'comfort' | 'pet') => Promise<string>;
  sleepPet: () => Promise<string>;
  wakePet: () => Promise<string>;
  sendMessage: (text: string) => Promise<void>;
  loadHistory: (petId: string) => Promise<void>;
  fetchTodayEvent: () => Promise<void>;
  fetchMemories: (petId: string) => Promise<void>;
  forgetMemory: (petId: string, memoryId: number) => Promise<boolean>;
  retirePet: () => Promise<string>;
  clearEvent: () => void;
  clearError: () => void;
}

export const usePetStore = create<PetState>((set, get) => ({
  user: null,
  isLoggedIn: false,
  pet: null,
  isLoading: false,
  isInteracting: false,
  error: null,
  chatHistory: [],
  todayEvent: null,
  memories: [],
  memoriesLoading: false,

  // ============================================================
  // 用户认证
  // ============================================================

  // 登录/注册/游客进入成功后，由页面调用以同步全局用户状态
  setAuth: (user: UserInfo) => {
    set({ user, isLoggedIn: true });
  },

  // 金币变动后同步（互动奖励、购买、签到等场景）
  updateCoins: (coins: number) => {
    set(state => ({ user: state.user ? { ...state.user, coins } : state.user }));
  },

  // 钻石变动后同步（成就解锁入账、钻石专属购买等场景）
  updateDiamonds: (diamonds: number) => {
    set(state => ({ user: state.user ? { ...state.user, diamonds } : state.user }));
  },

  // 从服务器拉取当前用户信息（app 重启后恢复全局用户状态）
  fetchUser: async () => {
    if (get().user) return; // 已有则不重复拉取
    try {
      const result = await apiFetch<{ user: UserInfo }>('/auth/profile');
      set({ user: result.user, isLoggedIn: true });
    } catch {
      // 静默失败（401 已由 apiFetch 处理）
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null, isLoggedIn: false, pet: null, chatHistory: [] });
  },

  // ============================================================
  // 宠物操作
  // ============================================================

  createPet: async (name: string, personality: Personality) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiFetch<{ pet: Pet; message: string }>('/pet/create', {
        method: 'POST',
        body: JSON.stringify({ name, personality }),
      });
      set({ pet: result.pet });
    } catch (err: any) {
      set({ error: err.message });
      throw err; // 让孵化页面感知失败，停留并提示
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPet: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiFetch<{ pets: Pet[] }>('/pet');
      const activePet = result.pets?.find(p => !p.isRetired);
      // 没有活跃宠物时清空，避免残留旧数据（如全部退休后）
      set({ pet: activePet || null });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  interact: async (action) => {
    const pet = get().pet;
    if (!pet) return '还没有宠物喵~';

    set({ isInteracting: true, error: null });
    try {
      const result = await apiFetch<{ pet: Pet; message: string; coinReward: number; totalCoins: number }>(`/pet/${pet.id}/interact`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      set({ pet: result.pet });
      // 同步金币到全局用户状态（首页用户栏实时显示）
      if (typeof result.totalCoins === 'number') {
        get().updateCoins(result.totalCoins);
      }
      return result.message;
    } catch (err: any) {
      set({ error: err.message });
      return '操作失败，请重试';
    } finally {
      set({ isInteracting: false });
    }
  },

  // 哄睡 / 叫醒（睡觉期间体力恢复、消耗减慢，唤醒返回恢复明细）
  sleepPet: async () => {
    const pet = get().pet;
    if (!pet) return '还没有宠物喵~';
    try {
      const result = await apiFetch<{ pet: Pet; message: string }>(`/pet/${pet.id}/sleep`, { method: 'POST' });
      set({ pet: { ...result.pet, isSleeping: true } });
      return result.message;
    } catch (err: any) {
      set({ error: err.message });
      return err.message || '哄睡失败，请重试';
    }
  },

  wakePet: async () => {
    const pet = get().pet;
    if (!pet) return '还没有宠物喵~';
    try {
      const result = await apiFetch<{ pet: Pet; message: string; minutesAsleep: number; energyRecovered: number }>(`/pet/${pet.id}/wake`, { method: 'POST' });
      set({ pet: { ...result.pet, isSleeping: false, sleepStartedAt: null } });
      return result.message;
    } catch (err: any) {
      set({ error: err.message });
      return err.message || '叫醒失败，请重试';
    }
  },

  sendMessage: async (text: string) => {
    const pet = get().pet;
    if (!pet) return;

    // 长度校验（与后端保持一致）
    if (text.length > 500) {
      set({ error: '消息过长，最多 500 字符' });
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    set(state => ({
      chatHistory: [...state.chatHistory, userMessage],
      error: null,
    }));

    try {
      const result = await apiFetch<{ reply: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          // chatHistory 已包含刚发出的 userMessage，直接发送过滤后的历史即可，
          // 避免重复追加导致最后一条用户消息出现两次、污染 AI 上下文
          messages: [...get().chatHistory.filter(m => !m.isLocal)],
          personality: pet.personality,
          petState: pet.stats,
          petId: pet.id,
        }),
      });

      set(state => ({
        chatHistory: [...state.chatHistory, {
          role: 'assistant',
          content: result.reply,
          timestamp: new Date().toISOString(),
        }],
      }));
    } catch (err: any) {
      set(state => ({
        chatHistory: [...state.chatHistory, {
          role: 'assistant',
          content: '喵...（网络开小差了，等一下再试试嘛）',
          timestamp: new Date().toISOString(),
          isLocal: true,
        }],
        error: err.message,
      }));
    }
  },

  // 从服务器加载聊天记录（重启 app 后恢复对话）
  loadHistory: async (petId: string) => {
    try {
      const result = await apiFetch<{ messages: { role: string; content: string; created_at: string }[] }>(`/ai/history/${petId}`);
      const history: ChatMessage[] = (result.messages || [])
        .filter((m): m is { role: 'user' | 'assistant'; content: string; created_at: string } =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content, timestamp: m.created_at }));
      set({ chatHistory: history });
    } catch {
      // 静默失败，保留本地消息
    }
  },

  // 触发随机日常事件（进入首页时调用一次；后端 AI 不可用时有本地兜底）
  // 事件奖励已由后端真实入账，这里同步金币到全局状态
  fetchTodayEvent: async () => {
    const { pet, todayEvent } = get();
    if (!pet || todayEvent) return;
    // 睡觉中的宠物没有随机事件（后端也有守卫）
    if (pet.isSleeping) return;
    try {
      const result = await apiFetch<{ event: string; reward: string; coinReward?: number; totalCoins?: number }>('/ai/event', {
        method: 'POST',
        body: JSON.stringify({ personality: pet.personality, petState: pet.stats, petId: pet.id }),
      });
      if (result?.event) {
        if (typeof result.totalCoins === 'number') {
          get().updateCoins(result.totalCoins);
        }
        const rewardText =
          typeof result.coinReward === 'number' && result.coinReward > 0
            ? `🪙+${result.coinReward}`
            : result.reward || '有小惊喜';
        set({ todayEvent: `${result.event}（${rewardText}）` });
      }
    } catch {
      // 静默失败，事件是锦上添花的功能
    }
  },

  // 拉取宠物记得的事（聊天页「记忆」入口）
  fetchMemories: async (petId: string) => {
    set({ memoriesLoading: true });
    try {
      const result = await apiFetch<{ memories: PetMemory[] }>(`/ai/memories/${petId}`);
      set({ memories: result.memories || [] });
    } catch {
      // 静默失败：记忆面板展示空态即可
    } finally {
      set({ memoriesLoading: false });
    }
  },

  // 遗忘一条记忆（乐观移除，失败时返回 false 由调用方提示）
  forgetMemory: async (petId: string, memoryId: number) => {
    try {
      await apiFetch(`/ai/memories/${petId}/${memoryId}`, { method: 'DELETE' });
      set(state => ({ memories: state.memories.filter(m => m.id !== memoryId) }));
      return true;
    } catch {
      return false;
    }
  },

  retirePet: async () => {
    const pet = get().pet;
    if (!pet) return '没有可退休的宠物';

    try {
      const result = await apiFetch<{ message: string }>(`/pet/${pet.id}/retire`, {
        method: 'POST',
      });
      set({ pet: null, chatHistory: [] });
      return result.message;
    } catch (err: any) {
      set({ error: err.message });
      return '退休失败，请重试';
    }
  },

  clearEvent: () => set({ todayEvent: null }),
  clearError: () => set({ error: null }),
}));
