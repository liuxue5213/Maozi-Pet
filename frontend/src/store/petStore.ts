/**
 * 帽子AI宠物 - 宠物状态管理（持久化 + JWT 鉴权版）
 */
import { create } from 'zustand';
import { apiFetch, getToken, setToken, clearToken } from '../config/env';

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
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UserInfo {
  id: string;
  type: 'guest' | 'registered';
  nickname: string;
  privacy: { showOnSquare: boolean; allowStrangerInteract: boolean; hidePetInfo: boolean };
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

  // --- Auth Actions ---
  login: () => Promise<void>;
  logout: () => Promise<void>;

  // --- Pet Actions ---
  createPet: (name: string, personality: Personality) => Promise<void>;
  fetchPet: () => Promise<void>;
  interact: (action: 'feed' | 'clean' | 'play' | 'comfort' | 'pet') => Promise<string>;
  sendMessage: (text: string) => Promise<void>;
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

  // ============================================================
  // 用户认证
  // ============================================================

  login: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiFetch<{ user: UserInfo; token: string }>('/auth/guest', {
        method: 'POST',
        body: JSON.stringify({
          nickname: '铲屎官',
        }),
      });

      await setToken(result.token);
      set({ user: result.user, isLoggedIn: true });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
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
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPet: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiFetch<{ pets: Pet[] }>('/pet');
      const activePet = result.pets?.find(p => !p.isRetired);
      if (activePet) {
        set({ pet: activePet });
      }
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
      const result = await apiFetch<{ pet: Pet; message: string }>(`/pet/${pet.id}/interact`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      set({ pet: result.pet });
      return result.message;
    } catch (err: any) {
      set({ error: err.message });
      return '操作失败，请重试';
    } finally {
      set({ isInteracting: false });
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
          messages: [...get().chatHistory, userMessage],
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
        }],
        error: err.message,
      }));
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
