/**
 * 帽子AI宠物 - 好友页面
 * 搜索添加好友、好友列表、串门
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSocialStore, Friend, FriendPet } from '../../store/socialStore';

// ============================================================
// 子组件
// ============================================================

function FriendCard({ friend, onVisit }: { friend: Friend; onVisit: () => void }) {
  return (
    <View style={styles.friendCard}>
      <View style={styles.friendAvatar}>
        <Text style={styles.friendAvatarEmoji}>🐱</Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{friend.nickname}</Text>
        <Text style={styles.friendSince}>
          {friend.type === 'guest' ? '游客' : '正式用户'} · 好友 since {friend.friendsSince ? new Date(friend.friendsSince).toLocaleDateString('zh-CN') : ''}
        </Text>
      </View>
      <TouchableOpacity style={styles.visitBtn} onPress={onVisit}>
        <Text style={styles.visitBtnText}>串门</Text>
      </TouchableOpacity>
    </View>
  );
}

function VisitModal({
  visible,
  onClose,
  friend,
  pets,
}: {
  visible: boolean;
  onClose: () => void;
  friend: any;
  pets: FriendPet[];
}) {
  if (!friend) return null;

  const stageLabel = (stage: string) => {
    if (stage === 'egg') return '宠物蛋';
    if (stage === 'child') return '幼体';
    if (stage === 'teen') return '少年';
    return '成年';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{friend.nickname} 的家园</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.visitContent}>
          {pets.length === 0 ? (
            <View style={styles.emptyPets}>
              <Text style={styles.emptyPetsEmoji}>🔒</Text>
              <Text style={styles.emptyPetsText}>该用户隐藏了宠物信息</Text>
            </View>
          ) : (
            pets.map(pet => (
              <View key={pet.id} style={styles.petCard}>
                <View style={styles.petCardAvatar}>
                  <Text style={styles.petCardEmoji}>
                    {pet.stage === 'egg' ? '🥚' : pet.stage === 'adult' ? '😺' : '🐱'}
                  </Text>
                </View>
                <View style={styles.petCardInfo}>
                  <Text style={styles.petCardName}>{pet.name}</Text>
                  <Text style={styles.petCardMeta}>
                    {stageLabel(pet.stage)} Lv.{pet.level} · {pet.personality}
                  </Text>
                  {/* 迷你状态条 */}
                  <View style={styles.miniStats}>
                    <MiniStat label="❤️" value={pet.stats.health} color="#FF6B6B" />
                    <MiniStat label="😊" value={pet.stats.mood} color="#FECA57" />
                    <MiniStat label="🍖" value={pet.stats.hunger} color="#FF9F43" />
                  </View>
                </View>
              </View>
            ))
          )}

          {/* 互动区（轻量） */}
          <View style={styles.interactBox}>
            <Text style={styles.interactTitle}>互动</Text>
            <View style={styles.interactBtns}>
              <TouchableOpacity style={styles.interactBtn}>
                <Text style={styles.interactBtnIcon}>🎁</Text>
                <Text style={styles.interactBtnLabel}>送小礼物</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.interactBtn}>
                <Text style={styles.interactBtnIcon}>👍</Text>
                <Text style={styles.interactBtnLabel}>点赞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.interactBtn}>
                <Text style={styles.interactBtnIcon}>💌</Text>
                <Text style={styles.interactBtnLabel}>留言</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <View style={styles.miniStatBar}>
        <View style={[styles.miniStatFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function FriendsScreen() {
  const {
    friends, searchResults, visitFriend,
    searchUsers, addFriend, fetchFriends, visitFriendHome, clearVisit,
  } = useSocialStore();

  const [searchText, setSearchText] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [])
  );

  const handleSearch = (text: string) => {
    setSearchText(text);
    searchUsers(text);
  };

  const handleVisit = async (friend: Friend) => {
    setSelectedFriend(friend);
    await visitFriendHome(friend.id);
  };

  return (
    <View style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={handleSearch}
          placeholder="搜索用户昵称添加好友..."
          placeholderTextColor="#BBB"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchText(''); searchUsers(''); }}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>搜索结果</Text>
            {searchResults.map((u: Friend) => (
              <View key={u.id} style={styles.searchResultItem}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarEmoji}>🐱</Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{u.nickname}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, u.isFriend && styles.addBtnDone]}
                  onPress={() => !u.isFriend && addFriend(u.id)}
                  disabled={u.isFriend}
                >
                  <Text style={[styles.addBtnText, u.isFriend && styles.addBtnTextDone]}>
                    {u.isFriend ? '已添加' : '+ 添加'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 好友列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>我的好友 ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyFriends}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>还没有好友</Text>
              <Text style={styles.emptySubtext}>搜索昵称添加好友，去串门吧~</Text>
            </View>
          ) : (
            friends.map((f: Friend) => (
              <FriendCard key={f.id} friend={f} onVisit={() => handleVisit(f)} />
            ))
          )}
        </View>
      </ScrollView>

      {/* 串门弹窗 */}
      <VisitModal
        visible={!!selectedFriend}
        onClose={() => { setSelectedFriend(null); clearVisit(); }}
        friend={selectedFriend}
        pets={visitFriend?.pets || []}
      />
    </View>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#444' },
  searchClear: { fontSize: 14, color: '#CCC', padding: 4 },
  content: { flex: 1 },
  section: { marginBottom: 20, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#777', marginBottom: 10, paddingHorizontal: 4 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarEmoji: { fontSize: 22 },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#5A4A4A' },
  friendSince: { fontSize: 11, color: '#BBB', marginTop: 2 },
  addBtn: {
    backgroundColor: '#FF9F43',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  addBtnDone: { backgroundColor: '#F0F0F0' },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  addBtnTextDone: { color: '#999' },
  visitBtn: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  visitBtnText: { fontSize: 13, fontWeight: '600', color: '#5A7A6A' },
  emptyFriends: { alignItems: 'center', paddingTop: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#777' },
  emptySubtext: { fontSize: 12, color: '#BBB', marginTop: 4 },

  // 串门弹窗
  modalContainer: { flex: 1, backgroundColor: '#FFF5F7' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  modalClose: { fontSize: 18, color: '#999' },
  visitContent: { flex: 1, padding: 16 },
  petCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  petCardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petCardEmoji: { fontSize: 26 },
  petCardInfo: { flex: 1, marginLeft: 12 },
  petCardName: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  petCardMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  miniStats: { marginTop: 8, gap: 4 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniStatLabel: { fontSize: 12, width: 20 },
  miniStatBar: { flex: 1, height: 5, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  miniStatFill: { height: '100%', borderRadius: 3 },
  emptyPets: { alignItems: 'center', paddingTop: 60 },
  emptyPetsEmoji: { fontSize: 40, marginBottom: 8 },
  emptyPetsText: { fontSize: 14, color: '#999' },
  interactBox: { marginTop: 20, backgroundColor: '#FFF', padding: 16, borderRadius: 14 },
  interactTitle: { fontSize: 14, fontWeight: '600', color: '#5A4A4A', marginBottom: 12 },
  interactBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  interactBtn: { alignItems: 'center', padding: 8 },
  interactBtnIcon: { fontSize: 24 },
  interactBtnLabel: { fontSize: 11, color: '#777', marginTop: 4 },
});
