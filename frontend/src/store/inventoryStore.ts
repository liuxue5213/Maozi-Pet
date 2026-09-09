/**
 * 帽子AI宠物 - 背包 & 家园状态管理
 * 装扮、家园场景、图鉴收集
 */
import { create } from 'zustand';
import { apiFetch } from '../config/env';

// ============================================================
// 类型
// ============================================================

export interface ItemDef {
  id: string;
  name: string;
  category: 'hat' | 'clothing' | 'accessory' | 'effect' | 'skin' | 'frame' | 'bubble' | 'furniture';
  icon: string;
  description?: string;
  priceCoins: number;
  priceDiamonds?: number;
  rarity: 'common' | 'rare' | 'epic';
  owned?: boolean;
  collected?: boolean;
  quantity?: number;
}

export interface EquipInfo {
  slot: string;
  itemId: string;
  name: string;
  icon: string;
  category: string;
}

export interface SceneDef {
  id: string;
  name: string;
  description: string;
  backgroundColor: string;
  icon: string;
  priceCoins: number;
  isDefault: boolean;
}

export interface CollectionItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
  rarity: string;
  collected: boolean;
}

// ============================================================
// Store
// ============================================================

interface InventoryState {
  // 物品
  backpack: ItemDef[];
  isLoading: boolean;

  // 装备
  equips: EquipInfo[];
  currentPetId: string | null;

  // 家园
  scenes: SceneDef[];
  currentScene: SceneDef | null;
  furniture: any[];

  // 图鉴
  collection: {
    overview: { total: number; collected: number; progress: number };
    categories: any[];
  };

  // Actions
  fetchBackpack: () => Promise<void>;
  equipItem: (petId: string, itemId: string, slot?: string) => Promise<void>;
  unequipItem: (petId: string, slot: string) => Promise<void>;
  fetchEquips: (petId: string) => Promise<void>;

  // 家园
  fetchScenes: () => Promise<void>;
  switchScene: (sceneId: string) => Promise<string>;
  fetchHome: () => Promise<void>;
  /** 摆放/收起一件家具（持有校验在服务端），返回更新后的摆放列表 */
  toggleFurniture: (itemId: string) => Promise<string[]>;

  // 图鉴
  fetchCollection: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  backpack: [],
  isLoading: false,
  equips: [],
  currentPetId: null,
  scenes: [],
  currentScene: null,
  furniture: [],
  collection: { overview: { total: 0, collected: 0, progress: 0 }, categories: [] },

  // 背包
  fetchBackpack: async () => {
    set({ isLoading: true });
    try {
      const result = await apiFetch<{ items: ItemDef[] }>('/inventory/backpack');
      set({ backpack: result.items });
    } catch (err: any) {
      console.error('获取背包失败:', err.message);
    } finally {
      set({ isLoading: false });
    }
  },

  // 装备
  equipItem: async (petId: string, itemId: string, slot?: string) => {
    await apiFetch(`/inventory/pets/${petId}/equip`, {
      method: 'POST',
      body: JSON.stringify({ itemId, slot }),
    });
    await get().fetchEquips(petId);
  },

  // 卸下
  unequipItem: async (petId: string, slot: string) => {
    await apiFetch(`/inventory/pets/${petId}/unequip`, {
      method: 'POST',
      body: JSON.stringify({ slot }),
    });
    await get().fetchEquips(petId);
  },

  // 获取装备
  fetchEquips: async (petId: string) => {
    try {
      const result = await apiFetch<{ equips: EquipInfo[] }>(`/inventory/pets/${petId}/equips`);
      set({ equips: result.equips, currentPetId: petId });
    } catch (err: any) {
      console.error('获取装备失败:', err.message);
    }
  },

  // 场景
  fetchScenes: async () => {
    try {
      const result = await apiFetch<{ scenes: SceneDef[]; currentScene: string; furniture: any[] }>('/inventory/scenes');
      set({ scenes: result.scenes, furniture: result.furniture });
      const current = result.scenes.find(s => s.id === result.currentScene);
      if (current) set({ currentScene: current });
    } catch (err: any) {
      console.error('获取场景失败:', err.message);
    }
  },

  switchScene: async (sceneId: string) => {
    const result = await apiFetch<{ message: string; scene: SceneDef }>('/inventory/home/scene', {
      method: 'POST',
      body: JSON.stringify({ sceneId }),
    });
    set({ currentScene: result.scene });
    return result.message;
  },

  // 摆放/收起一件家具：提交完整列表，服务端校验格式与持有后保存
  toggleFurniture: async (itemId: string) => {
    const current = get().furniture;
    const next = current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId];
    const result = await apiFetch<{ furniture: string[] }>('/inventory/home/furniture', {
      method: 'POST',
      body: JSON.stringify({ furniture: next }),
    });
    set({ furniture: result.furniture });
    return result.furniture;
  },

  fetchHome: async () => {
    try {
      const result = await apiFetch<{ scene: SceneDef; furniture: any[] }>('/inventory/home');
      set({ currentScene: result.scene, furniture: result.furniture });
    } catch (err: any) {
      console.error('获取家园失败:', err.message);
    }
  },

  // 图鉴
  fetchCollection: async () => {
    try {
      const result = await apiFetch<InventoryState['collection']>('/inventory/collection');
      set({ collection: result });
    } catch (err: any) {
      console.error('获取图鉴失败:', err.message);
    }
  },
}));
