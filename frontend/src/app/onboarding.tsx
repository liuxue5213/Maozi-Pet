/**
 * 帽子AI宠物 - 孵化引导页
 * 选择性格 → 孵化新宠物
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { usePetStore, Personality } from '../store/petStore';
import { useInventoryStore } from '../store/inventoryStore';
import { apiFetch } from '../config/env';

const PERSONALITIES: { key: Personality; emoji: string; label: string; desc: string }[] = [
  { key: 'cute', emoji: '🧸', label: '软萌治愈', desc: '软糯黏人，满嘴撒娇' },
  { key: 'tsundere', emoji: '😤', label: '傲娇毒舌', desc: '嘴上不饶人，心里全是爱' },
  { key: 'funny', emoji: '🤪', label: '沙雕活泼', desc: '满脑子骚操作，快乐制造机' },
  { key: 'calm', emoji: '🌸', label: '温柔安静', desc: '轻声细语，治愈系陪伴' },
  { key: 'cool', emoji: '😎', label: '高冷佛系', desc: '话不多但每句都是金句' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { createPet, isLoading } = usePetStore();
  const [selected, setSelected] = useState<Personality>('cute');
  const [name, setName] = useState('帽子');

  const [hatchError, setHatchError] = useState('');

  const handleHatch = async () => {
    const finalName = name.trim() || '帽子';
    setHatchError('');
    try {
      await createPet(finalName, selected);
      // 新手礼包：幂等领取，只有本轮真正发放的物品才提示（老用户重复孵化不误报）
      try {
        const result = await apiFetch<{ granted: { id: string; name: string }[] }>('/inventory/claim-starter', { method: 'POST' });
        if (result.granted.length > 0) {
          await useInventoryStore.getState().fetchBackpack();
          Alert.alert(
            '🎁 新手礼包到账',
            `${result.granted.map(i => i.name).join('、')} 已放入背包，去「背包」给${finalName}穿上吧！`
          );
        }
      } catch {
        // 礼包是增值体验，失败不打断孵化流程
      }
      // 成功才返回首页，useFocusEffect 会自动刷新宠物数据
      router.push('/');
    } catch {
      // 失败停留本页并提示（createPet 已把错误写入 store）
      setHatchError('孵化失败了，请检查网络后重试');
    }
  };

  const randomNames = ['咪咪', '小白', '橘子', '奶茶', '布丁', '芝麻', '汤圆', '年糕', '花花', '豆豆'];
  const handleRandomName = () => {
    const idx = Math.floor(Math.random() * randomNames.length);
    setName(randomNames[idx]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🥚 孵化新宠物</Text>
      <Text style={styles.subtitle}>选择它的性格，一段新的陪伴即将开始~</Text>

      {/* 名称输入 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>给小猫起个名字</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="输入名字..."
            placeholderTextColor="#CCC"
            maxLength={10}
            autoFocus
          />
          <TouchableOpacity style={styles.randomBtn} onPress={handleRandomName}>
            <Text style={styles.randomBtnText}>🎲</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.nameHint}>最多 10 个字符，不知道叫什么就掷骰子吧</Text>
      </View>

      {/* 性格选择 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择性格</Text>
        {PERSONALITIES.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.personalityCard, selected === p.key && styles.personalityCardActive]}
            onPress={() => setSelected(p.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.personalityEmoji}>{p.emoji}</Text>
            <View style={styles.personalityInfo}>
              <Text style={styles.personalityLabel}>{p.label}</Text>
              <Text style={styles.personalityDesc}>{p.desc}</Text>
            </View>
            {selected === p.key && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* 孵化按钮 */}
      <TouchableOpacity
        style={[styles.hatchBtn, isLoading && styles.hatchBtnDisabled]}
        onPress={handleHatch}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        <Text style={styles.hatchBtnText}>
          {isLoading ? '孵化中...' : '✨ 开始孵化'}
        </Text>
      </TouchableOpacity>

      {hatchError ? (
        <Text style={styles.errorText}>{hatchError}</Text>
      ) : (
        <>
          <Text style={styles.hint}>💡 性格将永久影响宠物的说话方式哦~</Text>
          <Text style={styles.onboardTips}>
            🌱 孵化后记得：每天来签到领金币 · 坚持现实好习惯让它成长 · 晚上哄睡恢复体力
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#5A4A4A', textAlign: 'center', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, marginBottom: 30 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A', marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9F43',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  randomBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  randomBtnText: { fontSize: 22 },
  nameHint: { fontSize: 11, color: '#CCC', marginTop: 6, marginLeft: 4 },
  personalityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  personalityCardActive: { borderColor: '#FF9F43', backgroundColor: '#FFF9F0' },
  personalityEmoji: { fontSize: 32, marginRight: 14 },
  personalityInfo: { flex: 1 },
  personalityLabel: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  personalityDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  checkmark: { fontSize: 20, color: '#FF9F43', fontWeight: '700' },
  hatchBtn: {
    backgroundColor: '#FF9F43',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({ ios: { shadowColor: '#FF9F43', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
  hatchBtnDisabled: { opacity: 0.6 },
  hatchBtnText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  hint: { fontSize: 12, color: '#BBB', textAlign: 'center', marginTop: 16 },
  onboardTips: {
    fontSize: 12,
    color: '#B08D57',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  errorText: { fontSize: 12, color: '#C0392B', textAlign: 'center', marginTop: 16 },
});
