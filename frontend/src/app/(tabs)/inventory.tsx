/**
 * 帽子AI宠物 - 背包 & 家园页
 * 装备穿戴、家园场景、图鉴收集
 * （购物统一走独立商城页，不再内嵌商城 tab）
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
import { useInventoryStore, ItemDef, SceneDef } from '../../store/inventoryStore';
import { usePetStore } from '../../store/petStore';
import { SKIN_RING_COLORS, DEFAULT_SKIN_RING, equippedItemId } from '../../config/appearance';

// ============================================================
// 子组件
// ============================================================

function SceneCard({
  scene,
  isActive,
  onSelect,
}: {
  scene: SceneDef;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sceneCard, isActive && styles.sceneCardActive]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={[styles.scenePreview, { backgroundColor: scene.backgroundColor }]}>
        <Text style={styles.sceneIcon}>{scene.icon}</Text>
      </View>
      <Text style={styles.sceneName}>{scene.name}</Text>
      <Text style={styles.sceneDesc}>{scene.description}</Text>
      {isActive ? (
        <View style={styles.sceneActiveBadge}>
          <Text style={styles.sceneActiveText}>当前场景</Text>
        </View>
      ) : scene.priceCoins > 0 && !scene.isDefault ? (
        <Text style={styles.scenePrice}>🪙 {scene.priceCoins}</Text>
      ) : (
        <Text style={styles.sceneFree}>免费</Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// 主页面
// ============================================================

type TabType = 'equip' | 'home' | 'collection';

// 与后端 VALID_SLOTS 对齐的 7 个装备槽位
const EQUIP_SLOTS: { key: string; label: string }[] = [
  { key: 'hat', label: '头饰' },
  { key: 'clothing', label: '衣服' },
  { key: 'accessory', label: '配饰' },
  { key: 'effect', label: '特效' },
  { key: 'skin', label: '皮肤' },
  { key: 'frame', label: '头像框' },
  { key: 'bubble', label: '气泡' },
];

export default function InventoryScreen() {
  const { pet } = usePetStore();
  const {
    backpack, equips, currentScene, scenes, collection,
    fetchBackpack, equipItem, unequipItem, fetchEquips,
    fetchScenes, switchScene, fetchCollection,
  } = useInventoryStore();

  const [activeTab, setActiveTab] = useState<TabType>('equip');
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchBackpack();
      fetchScenes();
      fetchCollection();
      if (pet) fetchEquips(pet.id);
    }, [pet?.id])
  );

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const handleEquip = async (itemId: string) => {
    if (!pet) {
      showMessage('请先创建宠物');
      return;
    }
    try {
      await equipItem(pet.id, itemId);
      showMessage('装备成功！');
    } catch (err: any) {
      showMessage(err.message);
    }
  };

  const handleSwitchScene = async (sceneId: string) => {
    try {
      const msg = await switchScene(sceneId);
      showMessage(msg);
    } catch (err: any) {
      showMessage(err.message);
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'equip', label: '装备', icon: '👗' },
    { key: 'home', label: '家园', icon: '🏠' },
    { key: 'collection', label: '图鉴', icon: '📖' },
  ];

  return (
    <View style={styles.container}>
      {/* 顶部 Tab */}
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 消息提示 */}
      {message ? (
        <View style={styles.messageBar}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      {/* 装备 Tab */}
      {activeTab === 'equip' && (
        <ScrollView style={styles.content}>
          {!pet ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🐱</Text>
              <Text style={styles.emptyText}>先创建宠物才能装备哦~</Text>
            </View>
          ) : (
            <>
              {/* 当前装备展示 */}
              <View style={styles.equipPreview}>
                <View
                  style={[
                    styles.petDisplay,
                    equippedItemId(equips, 'skin')
                      ? [styles.petDisplaySkinned, { borderColor: SKIN_RING_COLORS[equippedItemId(equips, 'skin') || ''] || DEFAULT_SKIN_RING }]
                      : null,
                  ]}
                >
                  <Text style={styles.petDisplayEmoji}>
                    {pet.stage === 'egg' ? '🥚' : pet.stage === 'adult' ? '😺' : '🐱'}
                  </Text>
                  {/* 已装备物品叠加显示 */}
                  {equips.filter(e => ['hat', 'clothing', 'accessory', 'effect'].includes(e.slot)).map(e => (
                    <Text key={e.slot} style={styles.equippedIcon}>{e.icon}</Text>
                  ))}
                </View>
                <Text style={styles.petDisplayName}>{pet.name}</Text>
              </View>

              {/* 装备槽位 */}
              <View style={styles.equipSlots}>
                {EQUIP_SLOTS.map(({ key: slot, label: slotLabel }) => {
                  const equipped = equips.find(e => e.slot === slot);
                  return (
                    <View key={slot} style={styles.slotRow}>
                      <Text style={styles.slotLabel}>{slotLabel}</Text>
                      {equipped ? (
                        <View style={styles.slotFilled}>
                          <Text style={styles.slotIcon}>{equipped.icon}</Text>
                          <Text style={styles.slotName}>{equipped.name}</Text>
                          <TouchableOpacity onPress={() => unequipItem(pet.id, slot)}>
                            <Text style={styles.unequipText}>卸下</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.slotEmpty}>
                          <Text style={styles.slotEmptyText}>未装备</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* 背包可装备物品 */}
              {backpack.length > 0 && (
                <View style={styles.equipItems}>
                  <Text style={styles.sectionTitle}>背包物品</Text>
                  <View style={styles.equipGrid}>
                    {backpack.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.equipItemCard}
                        onPress={() => handleEquip(item.id)}
                      >
                        <Text style={styles.equipItemIcon}>{item.icon}</Text>
                        <Text style={styles.equipItemName}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* 家园 Tab */}
      {activeTab === 'home' && (
        <ScrollView style={styles.content}>
          <View style={styles.scenesContainer}>
            <Text style={styles.sectionTitle}>选择场景</Text>
            {scenes.map(scene => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isActive={currentScene?.id === scene.id}
                onSelect={() => handleSwitchScene(scene.id)}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* 图鉴 Tab */}
      {activeTab === 'collection' && (
        <ScrollView style={styles.content}>
          {/* 总进度 */}
          <View style={styles.collectionHeader}>
            <Text style={styles.collectionTitle}>收集进度</Text>
            <Text style={styles.collectionProgress}>
              {collection.overview.collected}/{collection.overview.total}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${collection.overview.progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{collection.overview.progress}%</Text>
          </View>

          {/* 分类图鉴 */}
          {collection.categories.map((cat: any) => (
            <View key={cat.id} style={styles.collectionCategory}>
              <View style={styles.collectionCatHeader}>
                <Text style={styles.collectionCatTitle}>{cat.icon} {cat.name}</Text>
                <Text style={styles.collectionCatProgress}>{cat.collected}/{cat.total}</Text>
              </View>
              <View style={styles.collectionGrid}>
                {cat.items.map((item: any) => (
                  <View
                    key={item.id}
                    style={[styles.collectionItem, !item.collected && styles.collectionItemLocked]}
                  >
                    <Text style={[styles.collectionItemIcon, !item.collected && styles.collectionItemIconLocked]}>
                      {item.collected ? item.icon : '❓'}
                    </Text>
                    <Text style={[styles.collectionItemName, !item.collected && styles.collectionItemNameLocked]}>
                      {item.collected ? item.name : '???'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabActive: {},
  tabIcon: { fontSize: 20, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: '#BBB', marginTop: 2 },
  tabLabelActive: { color: '#FF9F43', fontWeight: '600' },
  messageBar: {
    backgroundColor: '#E8F8F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  messageText: { fontSize: 13, color: '#5A7A6A', textAlign: 'center' },
  content: { flex: 1 },

  // 装备
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#BBB' },
  equipPreview: { alignItems: 'center', paddingVertical: 20, backgroundColor: '#FFF', marginBottom: 16 },
  petDisplay: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF9F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  petDisplaySkinned: { borderWidth: 4 },
  petDisplayEmoji: { fontSize: 50 },
  equippedIcon: { position: 'absolute', fontSize: 18, bottom: -2, right: -2 },
  petDisplayName: { fontSize: 18, fontWeight: '700', color: '#5A4A4A', marginTop: 10 },
  equipSlots: { paddingHorizontal: 16, marginBottom: 16 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  slotLabel: { width: 50, fontSize: 13, color: '#777' },
  slotFilled: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotIcon: { fontSize: 20 },
  slotName: { flex: 1, fontSize: 14, color: '#444' },
  unequipText: { fontSize: 12, color: '#FF6B6B' },
  slotEmpty: { flex: 1, paddingVertical: 4 },
  slotEmptyText: { fontSize: 13, color: '#FF9F43' },
  equipItems: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A', marginBottom: 12 },
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  equipItemCard: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipItemIcon: { fontSize: 24 },
  equipItemName: { fontSize: 10, color: '#777', marginTop: 2 },

  // 家园
  scenesContainer: { padding: 16 },
  sceneCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  sceneCardActive: { borderColor: '#FF9F43' },
  scenePreview: {
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sceneIcon: { fontSize: 36 },
  sceneName: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  sceneDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  sceneActiveBadge: {
    marginTop: 8,
    backgroundColor: '#FFF0E0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  sceneActiveText: { fontSize: 11, color: '#FF9F43', fontWeight: '600' },
  scenePrice: { fontSize: 13, color: '#FF9F43', marginTop: 6 },
  sceneFree: { fontSize: 12, color: '#ABCFC4', marginTop: 6 },

  // 图鉴
  collectionHeader: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  collectionTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A', marginBottom: 4 },
  collectionProgress: { fontSize: 24, fontWeight: '700', color: '#FF9F43' },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#FF9F43', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#999', marginTop: 4 },
  collectionCategory: { marginBottom: 16, paddingHorizontal: 16 },
  collectionCatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionCatTitle: { fontSize: 15, fontWeight: '600', color: '#5A4A4A' },
  collectionCatProgress: { fontSize: 13, color: '#999' },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collectionItem: {
    width: 70,
    borderRadius: 12,
    backgroundColor: '#FFF',
    padding: 10,
    alignItems: 'center',
  },
  collectionItemLocked: { backgroundColor: '#F8F8F8', opacity: 0.6 },
  collectionItemIcon: { fontSize: 24 },
  collectionItemIconLocked: { opacity: 0.3 },
  collectionItemName: { fontSize: 10, color: '#777', marginTop: 4, textAlign: 'center' },
  collectionItemNameLocked: { color: '#CCC' },
});
