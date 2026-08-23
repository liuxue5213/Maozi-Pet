/**
 * 帽子AI宠物 - 个人资料页
 * 查看/编辑资料、统计、设置
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch, clearToken } from '../config/env';

interface UserProfile {
  id: string;
  type: string;
  nickname: string;
  email: string;
  avatarEmoji: string;
  bio: string;
  coins: number;
  diamonds: number;
  privacy: { showOnSquare: boolean; allowStrangerInteract: boolean; hidePetInfo: boolean };
  createdAt: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const result = await apiFetch<{ user: UserProfile; stats: any }>('/auth/profile');
      setProfile(result.user);
      setStats(result.stats);
      setEditNickname(result.user.nickname);
      setEditBio(result.user.bio);
    } catch (err: any) {
      if (err.message.includes('过期') || err.message.includes('无效')) {
        await clearToken();
        router.replace('/login');
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ nickname: editNickname, bio: editBio }),
      });
      setIsEditing(false);
      await fetchProfile();
    } catch (err: any) {
      console.error('保存失败:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearToken();
    router.replace('/login');
  };

  if (!profile) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingEmoji}>🐱</Text>
      </View>
    );
  }

  const avatars = ['🐱', '😺', '😸', '😻', '🙀', '😽', '🐈', '🐈‍⬛', '🦁', '🐯', '🐆', '🦊'];

  return (
    <ScrollView style={styles.container}>
      {/* 顶部工具栏 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>个人资料</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 头像 + 基本信息 */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.nameInput}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="昵称"
              maxLength={10}
            />
            <TextInput
              style={styles.bioInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="写点什么介绍自己..."
              maxLength={50}
              multiline
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isLoading}>
                <Text style={styles.saveBtnText}>{isLoading ? '保存中...' : '保存'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            {profile.email && <Text style={styles.email}>{profile.email}</Text>}
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <Text style={styles.editBtnText}>编辑资料</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* 统计 */}
      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.petCount}</Text>
            <Text style={styles.statLabel}>宠物</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.friendCount}</Text>
            <Text style={styles.statLabel}>好友</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.postCount}</Text>
            <Text style={styles.statLabel}>动态</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.daysSinceSignup}</Text>
            <Text style={styles.statLabel}>天数</Text>
          </View>
        </View>
      )}

      {/* 货币 */}
      <View style={styles.currencyCard}>
        <View style={styles.currencyItem}>
          <Text style={styles.currencyIcon}>🪙</Text>
          <Text style={styles.currencyValue}>{profile.coins}</Text>
          <Text style={styles.currencyLabel}>金币</Text>
        </View>
        <View style={styles.currencyItem}>
          <Text style={styles.currencyIcon}>💎</Text>
          <Text style={styles.currencyValue}>{profile.diamonds}</Text>
          <Text style={styles.currencyLabel}>钻石</Text>
        </View>
      </View>

      {/* 隐私设置 */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>隐私设置</Text>
        <SettingRow label="广场展示" value={profile.privacy.showOnSquare} />
        <SettingRow label="允许陌生人互动" value={profile.privacy.allowStrangerInteract} />
        <SettingRow label="隐藏宠物信息" value={profile.privacy.hidePetInfo} />
      </View>

      {/* 账号类型 */}
      <View style={styles.accountCard}>
        <Text style={styles.accountLabel}>账号类型</Text>
        <Text style={styles.accountType}>
          {profile.type === 'guest' ? '🎭 游客' : '✅ 正式用户'}
        </Text>
        {profile.type === 'guest' && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/register')}>
            <Text style={styles.upgradeBtnText}>注册正式账号（保留数据）</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>帽子AI宠物 v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function SettingRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' },
  loadingEmoji: { fontSize: 48 },
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
  backBtn: { paddingVertical: 4, width: 60 },
  backBtnText: { fontSize: 15, color: '#FF9F43', fontWeight: '500' },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#5A4A4A' },
  header: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#FFF' },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmoji: { fontSize: 40 },
  nickname: { fontSize: 22, fontWeight: '700', color: '#5A4A4A' },
  email: { fontSize: 13, color: '#999', marginTop: 4 },
  bio: { fontSize: 13, color: '#777', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 },
  editBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  editBtnText: { fontSize: 13, color: '#777' },
  editForm: { width: '100%', paddingHorizontal: 24, marginTop: 12 },
  nameInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  bioInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  editActions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  saveBtn: { backgroundColor: '#FF9F43', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  cancelBtn: { backgroundColor: '#F0F0F0', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 },
  cancelBtnText: { fontSize: 14, color: '#777' },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#FF9F43' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
  currencyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  currencyItem: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#FFF9F0', borderRadius: 12 },
  currencyIcon: { fontSize: 24 },
  currencyValue: { fontSize: 18, fontWeight: '700', color: '#5A4A4A', marginTop: 4 },
  currencyLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  settingsCard: {
    backgroundColor: '#FFF',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  settingsTitle: { fontSize: 15, fontWeight: '600', color: '#5A4A4A', marginBottom: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  settingLabel: { fontSize: 14, color: '#666' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E0E0E0', padding: 2 },
  toggleOn: { backgroundColor: '#FF9F43' },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleDotOn: { marginLeft: 20 },
  accountCard: {
    backgroundColor: '#FFF',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  accountLabel: { fontSize: 13, color: '#999', marginBottom: 4 },
  accountType: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  upgradeBtn: {
    marginTop: 12,
    backgroundColor: '#E8F8F5',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeBtnText: { fontSize: 13, fontWeight: '600', color: '#5A7A6A' },
  logoutBtn: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#FF6B6B' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 12, color: '#CCC' },
});
