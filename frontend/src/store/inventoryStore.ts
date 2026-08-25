/**
 * 帽子AI宠物 - 背包 & 家园状态管理
 * 装扮、家园场景、图鉴收集
 */
import { create } from 'zustand';
import { apiFetch } from '../config/env';
import { usePetStore } from './petStore';

// ============================================================
// 类型
// ============================================================

export interface ItemDef {
  id: string;
  name: string;
  category: 'hat' | 'clothing' | 'accessory' | 'effect';
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
  items: ItemDef[];
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
  fetchItems: () => Promise<void>;
  fetchBackpack: () => Promise<void>;
  buyItem: (itemId: string) => Promise<string>;
  equipItem: (petId: string, itemId: string, slot?: string) => Promise<void>;
  unequipItem: (petId: string, slot: string) => Promise<void>;
  fetchEquips: (petId: string) => Promise<void>;

  // 家园
  fetchScenes: () => Promise<void>;
  switchScene: (sceneId: string) => Promise<string>;
  fetchHome: () => Promise<void>;

  // 图鉴
  fetchCollection: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  backpack: [],
  isLoading: false,
  equips: [],
  currentPetId: null,
  scenes: [],
  currentScene: null,
  furniture: [],
  collection: { overview: { total: 0, collected: 0, progress: 0 }, categories: [] },

  // 商城物品
  fetchItems: async () => {
    try {
      const result = await apiFetch<{ items: ItemDef[]; categories: any[] }>('/inventory/items');
      set({ items: result.items });
    } catch (err: any) {
      console.error('获取物品失败:', err.message);
    }
  },

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

  // 购买（统一走 /shop/buy，后端事务实现）
  buyItem: async (itemId: string) => {
    const result = await apiFetch<{ message: string; coinsLeft: number }>(`/shop/buy/${itemId}`, {
      method: 'POST',
    });
    // 同步金币到全局用户状态
    usePetStore.getState().updateCoins(result.coinsLeft);
    // 刷新列表
    await get().fetchItems();
    await get().fetchBackpack();
    return result.message;
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
