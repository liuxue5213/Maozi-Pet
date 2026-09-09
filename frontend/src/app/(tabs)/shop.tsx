/**
 * 帽子AI宠物 - 商城页
 * 连续签到 + 商品浏览 + 购买
 * 只卖颜值 · 不卖数值 · 零压力
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch } from '../../config/env';
import { usePetStore } from '../../store/petStore';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48) / 2;

// ============================================================
// 类型
// ============================================================

interface ShopItem {
  id: string;
  name: string;
  category: string;
  shopCategory: string;
  icon: string;
  description: string;
  priceCoins: number;
  currency: 'coin' | 'diamond';
  rarity: 'common' | 'rare' | 'epic';
  isLimited: boolean;
  owned: boolean;
  collected: boolean;
}

interface CheckinStatus {
  todayChecked: boolean;
  currentStreak: number;
  nextReward: number;
  calendar: { day: number; reward: number; isToday: boolean; isCompleted: boolean }[];
}

// ============================================================
// 主页面
// ============================================================

export default function ShopScreen() {
  const router = useRouter();
  const updateCoins = usePetStore(s => s.updateCoins);
  const updateDiamonds = usePetStore(s => s.updateDiamonds);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const shopCategories = [
    { id: 'all', name: '全部', icon: '🛍️' },
    { id: 'decoration', name: '装扮', icon: '👗' },
    { id: 'effect', name: '特效', icon: '✨' },
    { id: 'skin', name: '皮肤', icon: '🐱' },
    { id: 'frame', name: '头像框', icon: '🖼️' },
    { id: 'bubble', name: '气泡', icon: '💬' },
    { id: 'furniture', name: '家具', icon: '🪑' },
  ];

  useFocusEffect(
    useCallback(() => {
      fetchCheckin();
      fetchItems();
    }, [selectedCategory])
  );

  const fetchCheckin = async () => {
    try {
      const result = await apiFetch<CheckinStatus>('/shop/checkin');
      setCheckin(result);
    } catch (err: any) {
      console.error('获取签到状态失败:', err.message);
    }
  };

  const fetchItems = async () => {
    try {
      const query = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const result = await apiFetch<{ items: ShopItem[] }>(`/shop/items${query}`);
      setItems(result.items);
    } catch (err: any) {
      console.error('获取商品失败:', err.message);
    }
  };

  const handleCheckin = async () => {
    if (checkin?.todayChecked) return;
    setIsLoading(true);
    try {
      const result = await apiFetch<{
        message: string;
        reward: number;
        streakDay: number;
        totalCoins: number;
      }>('/shop/checkin', { method: 'POST' });
      showMessage(result.message);
      updateCoins(result.totalCoins);
      await fetchCheckin();
    } catch (err: any) {
      showMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);

  const handleBuyPress = (item: ShopItem) => {
    // 弹出确认弹窗
    setConfirmItem(item);
  };

  const handleBuyConfirm = async () => {
    if (!confirmItem) return;
    const itemId = confirmItem.id;
    setConfirmItem(null);

    try {
      const result = await apiFetch<{ message: string; currency: 'coin' | 'diamond'; coinsLeft: number; diamondsLeft: number }>(`/shop/buy/${itemId}`, {
        method: 'POST',
      });
      showMessage(result.message);
      updateCoins(result.coinsLeft);
      updateDiamonds(result.diamondsLeft);
      await fetchItems();
    } catch (err: any) {
      showMessage(err.message);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2500);
  };

  const filteredItems = selectedCategory === 'all'
    ? items
    : items.filter(i => i.shopCategory === selectedCategory);

  const rarityColor = (rarity: string) => {
    if (rarity === 'epic') return '#9B59B6';
    if (rarity === 'rare') return '#54A0FF';
    return '#95A5A6';
  };

  const rarityLabel = (rarity: string) => {
    if (rarity === 'epic') return '史诗';
    if (rarity === 'rare') return '稀有';
    return '普通';
  };

  return (
    <View style={styles.container}>
      {/* 顶部工具栏 */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>🛒 商城</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Text style={styles.profileBtnText}>👤 我的</Text>
        </TouchableOpacity>
      </View>

      {/* 消息提示 */}
      {message ? (
        <View style={styles.messageBar}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scrollView}>
        {/* 签到卡片 */}
        <View style={styles.checkinCard}>
          <View style={styles.checkinHeader}>
            <Text style={styles.checkinTitle}>📅 连续签到</Text>
            <Text style={styles.checkinStreak}>连续 {checkin?.currentStreak || 0} 天</Text>
          </View>

          {/* 7天日历 */}
          <View style={styles.checkinCalendar}>
            {checkin?.calendar.map((day, idx) => (
              <View
                key={idx}
                style={[
                  styles.checkinDay,
                  day.isCompleted && styles.checkinDayCompleted,
                  day.isToday && !day.isCompleted && styles.checkinDayToday,
                ]}
              >
                <Text style={styles.checkinDayNum}>第{day.day}天</Text>
                <Text style={styles.checkinReward}>🪙{day.reward}</Text>
                {day.isCompleted && <Text style={styles.checkinDone}>✓</Text>}
              </View>
            ))}
          </View>

          {/* 签到按钮 */}
          <TouchableOpacity
            style={[styles.checkinBtn, checkin?.todayChecked && styles.checkinBtnDisabled]}
            onPress={handleCheckin}
            disabled={checkin?.todayChecked || isLoading}
          >
            <Text style={styles.checkinBtnText}>
              {checkin?.todayChecked
                ? '✅ 今日已签到'
                : isLoading
                ? '签到中...'
                : `🪙 签到领 ${checkin?.nextReward || 10} 金币`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 分类筛选 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryBar}>
          {shopCategories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                {cat.icon} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 商品网格 */}
        <View style={styles.itemsGrid}>
          {filteredItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              {/* 限定标签 */}
              {item.isLimited && (
                <View style={styles.limitedBadge}>
                  <Text style={styles.limitedText}>限定</Text>
                </View>
              )}

              {/* 物品图标 */}
              <View style={[styles.itemIconBox, { borderColor: rarityColor(item.rarity) }]}>
                <Text style={styles.itemIcon}>{item.icon}</Text>
              </View>

              {/* 信息 */}
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={[styles.itemRarity, { color: rarityColor(item.rarity) }]}>
                {rarityLabel(item.rarity)}
              </Text>

              {/* 购买按钮 */}
              {item.owned ? (
                <View style={styles.ownedBadge}>
                  <Text style={styles.ownedText}>已拥有</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.buyBtn, item.currency === 'diamond' && styles.buyBtnDiamond]}
                  onPress={() => handleBuyPress(item)}
                >
                  <Text style={styles.buyBtnText}>
                    {item.currency === 'diamond' ? '💎' : '🪙'} {item.priceCoins}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>💡 所有商品均为外观道具，不影响数值平衡</Text>
        </View>
      </ScrollView>

      {/* 购买确认弹窗 */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.confirmOverlay}>
          {confirmItem && (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmIcon}>{confirmItem.icon}</Text>
              <Text style={styles.confirmTitle}>确认购买</Text>
              <Text style={styles.confirmName}>{confirmItem.name}</Text>
              <Text style={styles.confirmPrice}>
                {confirmItem.currency === 'diamond'
                  ? `💎 ${confirmItem.priceCoins} 钻石`
                  : `🪙 ${confirmItem.priceCoins} 金币`}
              </Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmItem(null)}>
                  <Text style={styles.confirmCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmOk} onPress={handleBuyConfirm}>
                  <Text style={styles.confirmOkText}>确认购买</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: '#5A4A4A' },
  profileBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F8F8F8' },
  profileBtnText: { fontSize: 13, color: '#777' },
  messageBar: {
    backgroundColor: '#E8F8F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ABCFC4',
  },
  messageText: { fontSize: 13, color: '#5A7A6A', textAlign: 'center' },
  scrollView: { flex: 1 },

  // 签到
  checkinCard: {
    backgroundColor: '#FFF',
    margin: 16,
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  checkinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkinTitle: { fontSize: 16, fontWeight: '700', color: '#5A4A4A' },
  checkinStreak: { fontSize: 13, color: '#FF9F43', fontWeight: '600' },
  checkinCalendar: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  checkinDay: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 0,
  },
  checkinDayCompleted: { backgroundColor: '#E8F8E8' },
  checkinDayToday: { backgroundColor: '#FFF0E0', borderWidth: 2, borderColor: '#FF9F43' },
  checkinDayNum: { fontSize: 9, color: '#BBB' },
  checkinReward: { fontSize: 12, fontWeight: '600', color: '#FF9F43', marginTop: 2 },
  checkinDone: { fontSize: 12, color: '#5A7A6A', marginTop: 1 },
  checkinBtn: {
    backgroundColor: '#FF9F43',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  checkinBtnDisabled: { backgroundColor: '#E0E0E0' },
  checkinBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // 分类
  categoryBar: { paddingHorizontal: 16, marginBottom: 12, flexGrow: 0 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#FFF0E0' },
  categoryText: { fontSize: 13, color: '#999' },
  categoryTextActive: { color: '#FF9F43', fontWeight: '600' },

  // 商品
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  itemCard: {
    width: ITEM_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  limitedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 1,
  },
  limitedText: { fontSize: 9, color: '#FFF', fontWeight: '600' },
  itemIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF9F0',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemIcon: { fontSize: 30 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#5A4A4A', textAlign: 'center' },
  itemRarity: { fontSize: 10, marginTop: 2 },
  buyBtn: {
    marginTop: 10,
    backgroundColor: '#FF9F43',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  buyBtnDiamond: { backgroundColor: '#5DC2E0' },
  buyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  ownedBadge: {
    marginTop: 10,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  ownedText: { fontSize: 13, color: '#999' },
  footer: { padding: 24, alignItems: 'center' },
  footerText: { fontSize: 12, color: '#CCC', textAlign: 'center' },

  // 购买确认弹窗
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBox: {
    width: 280,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  confirmIcon: { fontSize: 48, marginBottom: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#5A4A4A', marginBottom: 8 },
  confirmName: { fontSize: 16, color: '#777', marginBottom: 4 },
  confirmPrice: { fontSize: 16, fontWeight: '600', color: '#FF9F43', marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: '#777' },
  confirmOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FF9F43',
    alignItems: 'center',
  },
  confirmOkText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
