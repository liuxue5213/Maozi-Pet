/**
 * 帽子AI宠物 - 纪念海报
 * 把"独家养成记忆"变成可分享的身份认同（网易云年报式情感表达）
 * 数据来自 GET /social/poster/:petId，文案由后端按性格生成
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '../config/env';

interface PosterData {
  petName: string;
  personality: string;
  stage: string;
  level: number;
  daysOwned: number;
  totalInteractions: number;
  ownerNickname: string;
  quote: string;
}

const PERSONALITY_STYLE: Record<string, { bg: string; accent: string; label: string; emoji: string }> = {
  cute: { bg: '#FFE8EE', accent: '#FF6B9D', label: '软萌治愈', emoji: '🧸' },
  tsundere: { bg: '#FFF0E0', accent: '#FF9F43', label: '傲娇毒舌', emoji: '😤' },
  funny: { bg: '#EFF8FF', accent: '#54A0FF', label: '沙雕活泼', emoji: '🤪' },
  calm: { bg: '#EAF6EF', accent: '#5A9E7F', label: '温柔安静', emoji: '🌸' },
  cool: { bg: '#ECEAF6', accent: '#7B6CD9', label: '高冷佛系', emoji: '😎' },
};

const STAGE_LABELS: Record<string, string> = {
  egg: '宠物蛋', child: '幼体', teen: '少年', adult: '成年',
};

export default function PosterScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const [poster, setPoster] = useState<PosterData | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const posterCardRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!petId) return;
        try {
          const result = await apiFetch<{ poster: PosterData }>(`/social/poster/${petId}`);
          setPoster(result.poster);
        } catch (err: any) {
          setError(err.message || '海报加载失败');
        }
      })();
    }, [petId])
  );

  const handleShare = async () => {
    if (!poster) return;
    try {
      await Share.share({
        message: `🐾 我和${poster.petName}已经相伴 ${poster.daysOwned} 天，互动 ${poster.totalInteractions} 次！\n「${poster.quote}」\n—— 帽子AI宠物`,
      });
    } catch {
      // 用户取消分享不处理
    }
  };

  // 海报卡片截图 → 系统分享图片（Web 降级为文本分享）
  const handleExportImage = async () => {
    if (!poster || exporting) return;
    if (Platform.OS === 'web') {
      handleShare();
      return;
    }
    setExporting(true);
    try {
      const uri = await captureRef(posterCardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `分享 ${poster.petName} 的养成纪念海报`,
        });
      } else {
        await handleShare();
      }
    } catch {
      // 截图失败降级为文本分享
      await handleShare();
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>😿</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!poster) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9F43" />
      </View>
    );
  }

  const style = PERSONALITY_STYLE[poster.personality] || PERSONALITY_STYLE.cute;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 海报卡片 */}
      <View ref={posterCardRef} collapsable={false} style={[styles.poster, { backgroundColor: style.bg, borderColor: style.accent }]}>
        <Text style={[styles.posterBrand, { color: style.accent }]}>🐱 帽子AI宠物 · 独家养成记忆</Text>
        <Text style={styles.posterEmoji}>{style.emoji}</Text>
        <Text style={[styles.posterName, { color: style.accent }]}>{poster.petName}</Text>
        <Text style={styles.posterMeta}>
          {style.label} · {STAGE_LABELS[poster.stage] || poster.stage} Lv.{poster.level}
        </Text>

        <View style={[styles.posterDivider, { backgroundColor: style.accent }]} />

        <View style={styles.posterStats}>
          <View style={styles.posterStat}>
            <Text style={[styles.posterStatValue, { color: style.accent }]}>{poster.daysOwned}</Text>
            <Text style={styles.posterStatLabel}>相伴天数</Text>
          </View>
          <View style={styles.posterStat}>
            <Text style={[styles.posterStatValue, { color: style.accent }]}>{poster.totalInteractions}</Text>
            <Text style={styles.posterStatLabel}>互动次数</Text>
          </View>
        </View>

        <Text style={styles.posterQuote}>「{poster.quote}」</Text>
        <Text style={styles.posterOwner}>—— {poster.ownerNickname} 与 {poster.petName}</Text>
      </View>

      {/* 分享：图片直出（社交平台标准），文本分享兜底 */}
      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: style.accent }]}
        onPress={handleExportImage}
        disabled={exporting}
      >
        <Text style={styles.shareBtnText}>{exporting ? '生成图片中…' : '🎴 分享海报图片'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.textShareBtn} onPress={handleShare}>
        <Text style={styles.backText}>分享文字版</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← 返回档案馆</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5F7' },
  errorEmoji: { fontSize: 48, marginBottom: 8 },
  errorText: { fontSize: 14, color: '#999', marginBottom: 16 },
  poster: {
    borderRadius: 24,
    borderWidth: 3,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  posterBrand: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  posterEmoji: { fontSize: 72, marginTop: 12 },
  posterName: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  posterMeta: { fontSize: 13, color: '#777', marginTop: 4 },
  posterDivider: { width: 48, height: 3, borderRadius: 2, marginVertical: 16 },
  posterStats: { flexDirection: 'row', gap: 32 },
  posterStat: { alignItems: 'center' },
  posterStatValue: { fontSize: 26, fontWeight: '800' },
  posterStatLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  posterQuote: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  posterOwner: { fontSize: 11, color: '#AAA', marginTop: 12 },
  shareBtn: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  textShareBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  backBtn: { paddingVertical: 14, alignItems: 'center' },
  backText: { fontSize: 14, color: '#BBB' },
});
