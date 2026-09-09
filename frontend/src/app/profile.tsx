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
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, clearToken } from '../config/env';
import { usePetStore } from '../store/petStore';
import { useInventoryStore } from '../store/inventoryStore';
import { FRAME_RING_COLORS, DEFAULT_FRAME_RING, equippedItemId } from '../config/appearance';

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
  const [editAvatar, setEditAvatar] = useState('🐱');
  const [isLoading, setIsLoading] = useState(false);
  // 推送免打扰时段（HH:MM）
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [quietSaving, setQuietSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      // 推送免打扰设置 + 头像框装扮：进页面时拉一次当前宠物的装备
      const currentPet = usePetStore.getState().pet;
      if (currentPet) {
        useInventoryStore.getState().fetchEquips(currentPet.id);
      }
      apiFetch<{ quietStart: string | null; quietEnd: string | null }>('/push/settings')
        .then(s => {
          setQuietStart(s.quietStart || '');
          setQuietEnd(s.quietEnd || '');
        })
        .catch(() => {});
    }, [])
  );

  // 保存免打扰时段（非法输入由后端归一为关闭）
  const handleSaveQuietHours = async () => {
    setQuietSaving(true);
    try {
      const result = await apiFetch<{ message: string }>('/push/settings', {
        method: 'POST',
        body: JSON.stringify({ quietStart: quietStart.trim(), quietEnd: quietEnd.trim() }),
      });
      Alert.alert('提示', result.message);
    } catch (err: any) {
      Alert.alert('提示', err.message || '保存失败，请重试');
    } finally {
      setQuietSaving(false);
    }
  };

  const handleClearQuietHours = async () => {
    setQuietSaving(true);
    try {
      await apiFetch('/push/settings', {
        method: 'POST',
        body: JSON.stringify({ quietStart: null, quietEnd: null }),
      });
      setQuietStart('');
      setQuietEnd('');
      Alert.alert('提示', '免打扰已关闭');
    } catch {
      Alert.alert('提示', '操作失败，请重试');
    } finally {
      setQuietSaving(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const result = await apiFetch<{ user: UserProfile; stats: any }>('/auth/profile');
      setProfile(result.user);
      setStats(result.stats);
      setEditNickname(result.user.nickname);
      setEditBio(result.user.bio);
      setEditAvatar(result.user.avatarEmoji || '🐱');
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
        body: JSON.stringify({ nickname: editNickname, bio: editBio, avatarEmoji: editAvatar }),
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

  // 切换隐私开关（乐观更新，失败回滚）
  type PrivacyKey = 'showOnSquare' | 'allowStrangerInteract' | 'hidePetInfo';
  const handleTogglePrivacy = async (key: PrivacyKey, value: boolean) => {
    if (!profile) return;
    const prev = profile;
    setProfile({ ...profile, privacy: { ...profile.privacy, [key]: value } });
    try {
      await apiFetch('/auth/privacy', {
        method: 'PUT',
        body: JSON.stringify({ privacy: { [key]: value } }),
      });
    } catch (err: any) {
      setProfile(prev);
      Alert.alert('提示', '设置失败，请重试');
    }
  };

  if (!profile) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingEmoji}>🐱</Text>
      </View>
    );
  }

  const avatars = ['🐱', '😺', '😸', '😻', '🙀', '😽', '🐈', '🐈‍⬛', '🦁', '🐯', '🐆', '🦊'];

  // 头像框装备 → 头像描边换色
  const equips = useInventoryStore(state => state.equips);
  const frameItemId = equippedItemId(equips, 'frame');
  const frameRing = (frameItemId && FRAME_RING_COLORS[frameItemId]) || DEFAULT_FRAME_RING;

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
        <View style={[styles.avatarCircle, frameItemId ? styles.avatarCircleFramed : null, frameItemId ? { borderColor: frameRing } : null]}>
          <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
        </View>

        {isEditing ? (
          <View style={styles.editForm}>
            {/* 头像选择 */}
            <Text style={styles.avatarPickerLabel}>选择头像</Text>
            <View style={styles.avatarPicker}>
              {avatars.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.avatarOption, editAvatar === a && styles.avatarOptionSelected]}
                  onPress={() => setEditAvatar(a)}
                >
                  <Text style={styles.avatarOptionEmoji}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.nameInput}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="昵称"
              maxLength={20}
            />
            <TextInput
              style={styles.bioInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="写点什么介绍自己..."
              maxLength={100}
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
        <SettingRow
          label="广场展示"
          description="关闭后你的动态不会出现在广场"
          value={profile.privacy.showOnSquare}
          onToggle={v => handleTogglePrivacy('showOnSquare', v)}
        />
        <SettingRow
          label="允许陌生人互动"
          description="关闭后陌生人无法与你互动"
          value={profile.privacy.allowStrangerInteract}
          onToggle={v => handleTogglePrivacy('allowStrangerInteract', v)}
        />
        <SettingRow
          label="隐藏宠物信息"
          description="开启后好友串门看不到你的宠物详情"
          value={profile.privacy.hidePetInfo}
          onToggle={v => handleTogglePrivacy('hidePetInfo', v)}
        />
      </View>

      {/* 推送免打扰时段 */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>🌙 推送免打扰</Text>
        <Text style={styles.quietHint}>该时段内「帽子想你了」推送保持安静（支持跨零点，如 22:00 ~ 08:00）</Text>
        <View style={styles.quietRow}>
          <TextInput
            style={styles.quietInput}
            value={quietStart}
            onChangeText={setQuietStart}
            placeholder="22:00"
            placeholderTextColor="#CCC"
            maxLength={5}
          />
          <Text style={styles.quietTilde}>~</Text>
          <TextInput
            style={styles.quietInput}
            value={quietEnd}
            onChangeText={setQuietEnd}
            placeholder="08:00"
            placeholderTextColor="#CCC"
            maxLength={5}
          />
          <TouchableOpacity style={styles.quietSaveBtn} onPress={handleSaveQuietHours} disabled={quietSaving}>
            <Text style={styles.quietSaveText}>{quietSaving ? '...' : '保存'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleClearQuietHours}>
          <Text style={styles.quietClear}>清除免打扰设置</Text>
        </TouchableOpacity>
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

      {/* 档案馆入口 */}
      <TouchableOpacity style={styles.archiveBtn} onPress={() => router.push('/archive')}>
        <Text style={styles.archiveBtnText}>🏛️ 宠物档案馆</Text>
      </TouchableOpacity>

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

function SettingRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => onToggle(!value)}>
      <View style={styles.settingTextWrap}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
      </View>
    </TouchableOpacity>
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
  avatarCircleFramed: { borderWidth: 4 },
  quietHint: { fontSize: 12, color: '#999', marginBottom: 10, lineHeight: 18 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quietInput: {
    width: 76,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#5A4A4A',
    textAlign: 'center',
  },
  quietTilde: { fontSize: 14, color: '#BBB' },
  quietSaveBtn: {
    backgroundColor: '#FF9F43',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 4,
  },
  quietSaveText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  quietClear: { fontSize: 12, color: '#BBB', marginTop: 10 },
  avatarEmoji: { fontSize: 40 },
  avatarPickerLabel: { fontSize: 13, fontWeight: '600', color: '#777', marginBottom: 8, textAlign: 'center' },
  avatarPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  avatarOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: { borderColor: '#FF9F43', backgroundColor: '#FFF9F0' },
  avatarOptionEmoji: { fontSize: 24 },
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
  settingTextWrap: { flex: 1, paddingRight: 12 },
  settingLabel: { fontSize: 14, color: '#666' },
  settingDesc: { fontSize: 11, color: '#C0A8A8', marginTop: 2 },
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
  archiveBtn: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#FFF0E0',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  archiveBtnText: { fontSize: 14, fontWeight: '600', color: '#FF9F43' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 12, color: '#CCC' },
});
