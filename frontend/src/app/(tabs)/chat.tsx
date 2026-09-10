/**
 * 帽子AI宠物 - AI 聊天页
 * 和宠物自由对话
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  Platform,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePetStore } from '../../store/petStore';
import { useInventoryStore } from '../../store/inventoryStore';
import { apiFetch } from '../../config/env';
import { BUBBLE_STYLES, SKIN_RING_COLORS, equippedItemId } from '../../config/appearance';

export default function ChatScreen() {
  const { pet, chatHistory, sendMessage, loadHistory, memories, memoriesLoading, fetchMemories, forgetMemory } = usePetStore();
  const equips = useInventoryStore(state => state.equips);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [weekly, setWeekly] = useState<{ petName: string; total: number; weeklyCount: number; items: { content: string; created_at: string }[]; shareText: string } | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // 装扮外显：气泡样式（默认宠物消息白底）+ 皮肤描边
  const bubbleItemId = equippedItemId(equips, 'bubble');
  const bubbleStyle = (bubbleItemId && BUBBLE_STYLES[bubbleItemId]) || null;
  const skinItemId = equippedItemId(equips, 'skin');
  const skinRing = (skinItemId && SKIN_RING_COLORS[skinItemId]) || 'transparent';

  // 进入页面时从服务器恢复聊天记录（重启 app 不丢对话）
  useFocusEffect(
    React.useCallback(() => {
      const currentPet = usePetStore.getState().pet;
      if (currentPet) {
        loadHistory(currentPet.id);
      }
    }, [loadHistory])
  );

  useEffect(() => {
    // 自动滚动到底部
    if (chatHistory.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    }
  }, [chatHistory.length]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input.trim();
    setInput('');
    setIsSending(true);
    try {
      await sendMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  // 打开记忆面板时拉取最新记忆
  const openMemories = () => {
    if (!pet) return;
    fetchMemories(pet.id);
    setShowMemories(true);
  };

  // 打开本周记忆周报（滚动 7 天窗口，宠物口吻分享文案由后端生成）
  const openWeekly = async () => {
    if (!pet || weeklyLoading) return;
    setWeeklyLoading(true);
    try {
      const data = await apiFetch<{
        petName: string; total: number; weeklyCount: number;
        items: { content: string; created_at: string }[]; shareText: string;
      }>(`/ai/memories/${pet.id}/weekly`);
      setWeekly(data);
      setShowWeekly(true);
    } catch (err: any) {
      Alert.alert('提示', err.message || '周报加载失败，请重试');
    } finally {
      setWeeklyLoading(false);
    }
  };

  // 分享周报（原生系统分享 / Web 复制到剪贴板）
  const handleShareWeekly = async () => {
    if (!weekly) return;
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(weekly.shareText);
        Alert.alert('已复制', '周报文案已复制到剪贴板，去粘贴分享吧~');
      } catch {
        Alert.alert('提示', '复制失败，请长按文案手动复制');
      }
      return;
    }
    await Share.share({ title: `${weekly.petName}的记忆周报`, message: weekly.shareText });
  };

  // 遗忘一条记忆（二次确认）
  const handleForget = (memoryId: number) => {
    if (!pet) return;
    Alert.alert('忘记这件事？', '忘记后它就再也不记得啦', [
      { text: '再想想', style: 'cancel' },
      {
        text: '忘记',
        style: 'destructive',
        onPress: async () => {
          const ok = await forgetMemory(pet.id, memoryId);
          if (!ok) Alert.alert('提示', '操作失败，请重试');
        },
      },
    ]);
  };

  // 导出记忆（可带走：Web 下载 JSON / 原生系统分享）
  const handleExport = async () => {
    if (!pet) return;
    try {
      const data = await apiFetch<{
        pet: { name: string; personality: string; stage: string; level: number };
        total: number;
        memories: { content: string; created_at: string }[];
      }>(`/ai/memories/${pet.id}/export`);

      if (Platform.OS === 'web') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `帽子记忆-${data.pet.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const lines = data.memories.map(m => `· ${m.content}（${m.created_at.slice(0, 10)}）`).join('\n');
        await Share.share({
          title: `帽子记忆-${data.pet.name}`,
          message: `🐱 ${data.pet.name} 记得的 ${data.total} 件关于我的事：\n${lines || '（还没有记忆）'}`,
        });
      }
    } catch (err: any) {
      Alert.alert('提示', err.message || '导出失败，请重试');
    }
  };

  if (!pet) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyText}>先孵化宠物才能聊天哦~</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* 顶部记忆入口 */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.memoryBtn} onPress={openMemories}>
          <Text style={styles.memoryBtnText}>🧠 它记得的事{memories.length > 0 ? `（${memories.length}）` : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* 睡觉提示：此时发消息只会收到 Zzz 回复 */}
      {pet.isSleeping && (
        <View style={styles.sleepBanner}>
          <Text style={styles.sleepBannerText}>😴 {pet.name} 睡得正香，它醒来看得到你的话</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={chatHistory}
        keyExtractor={(item, index) => `${index}-${item.timestamp}`}
        renderItem={({ item }) => (
          <View style={[
            styles.messageRow,
            item.role === 'user' ? styles.userRow : styles.petRow,
          ]}>
            {item.role === 'assistant' && (
              <View style={[styles.petAvatar, skinItemId ? { borderWidth: 3, borderColor: skinRing } : null]}>
                <Text style={styles.petAvatarText}>🐱</Text>
              </View>
            )}
            <View style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.petBubble,
              item.role === 'assistant' && bubbleStyle ? {
                backgroundColor: bubbleStyle.backgroundColor,
                borderWidth: 2,
                borderColor: bubbleStyle.borderColor,
              } : null,
            ]}>
              <Text style={[
                styles.bubbleText,
                item.role === 'user' ? styles.userText : styles.petText,
              ]}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatEmoji}>🐱</Text>
            <Text style={styles.emptyChatText}>和{pet.name}说点什么吧~</Text>
          </View>
        }
      />

      {/* 输入框 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={`对${pet.name}说...`}
          placeholderTextColor="#BBB"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
        >
          <Text style={styles.sendBtnText}>{isSending ? '...' : '发送'}</Text>
        </TouchableOpacity>
      </View>

      {/* 记忆面板：查看/遗忘宠物记住的事 */}
      <Modal visible={showMemories} animationType="slide" transparent onRequestClose={() => setShowMemories(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🧠 它记得的事</Text>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity style={styles.exportBtn} onPress={openWeekly} disabled={weeklyLoading}>
                  <Text style={styles.exportBtnText}>{weeklyLoading ? '加载中…' : '📄 周报'}</Text>
                </TouchableOpacity>
                {memories.length > 0 && (
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
                    <Text style={styles.exportBtnText}>📥 导出</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowMemories(false)}>
                  <Text style={styles.modalClose}>完成</Text>
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={memories}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.memoryRow}>
                  <View style={styles.memoryContent}>
                    <Text style={styles.memoryText}>{item.content}</Text>
                    <Text style={styles.memoryTime}>{item.created_at.slice(5, 10)} 记下的</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleForget(item.id)}>
                    <Text style={styles.forgetBtn}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.memoryEmpty}>
                  <Text style={styles.memoryEmptyText}>
                    {memoriesLoading ? '翻找记忆中...' : '还没有记忆~ 多聊聊，说「我叫...」「我喜欢...」，它会记在心里'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* 记忆周报：本周记下的小事 + 一键分享 */}
      <Modal visible={showWeekly} animationType="slide" transparent onRequestClose={() => setShowWeekly(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📄 {weekly?.petName ?? '宠物'}的周报</Text>
              <TouchableOpacity onPress={() => setShowWeekly(false)}>
                <Text style={styles.modalClose}>完成</Text>
              </TouchableOpacity>
            </View>
            {weekly && (
              <>
                <Text style={styles.weeklySubtitle}>
                  近 7 天记下了 {weekly.weeklyCount} 件小事（累计 {weekly.total} 条记忆）
                </Text>
                <FlatList
                  data={weekly.items}
                  keyExtractor={(item, i) => `${i}-${item.created_at}`}
                  renderItem={({ item }) => (
                    <View style={styles.memoryRow}>
                      <View style={styles.memoryContent}>
                        <Text style={styles.memoryText}>{item.content}</Text>
                        <Text style={styles.memoryTime}>{item.created_at.slice(5, 10)} 记下的</Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={styles.memoryEmpty}>
                      <Text style={styles.memoryEmptyText}>
                        这周还没有新记忆~ 多和它聊聊，说「我叫...」「我喜欢...」，它会记在心里
                      </Text>
                    </View>
                  }
                />
                <TouchableOpacity style={styles.weeklyShareBtn} onPress={handleShareWeekly}>
                  <Text style={styles.weeklyShareBtnText}>📣 分享周报</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  weeklySubtitle: { fontSize: 12, color: '#999', paddingHorizontal: 16, paddingBottom: 8 },
  weeklyShareBtn: {
    margin: 16,
    backgroundColor: '#E8A87C',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  weeklyShareBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFF5F7',
  },
  memoryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memoryBtnText: { fontSize: 13, color: '#8A6A6A' },
  sleepBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#EDE8FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sleepBannerText: { fontSize: 12, color: '#5F27CD' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '55%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0F0',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  modalClose: { fontSize: 14, color: '#FF9F43', fontWeight: '600' },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  exportBtn: {
    backgroundColor: '#E8F8F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  exportBtnText: { fontSize: 12, color: '#5A7A6A', fontWeight: '600' },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FAF5F5',
  },
  memoryContent: { flex: 1 },
  memoryText: { fontSize: 14, color: '#5A4A4A', lineHeight: 20 },
  memoryTime: { fontSize: 11, color: '#C0A8A8', marginTop: 2 },
  forgetBtn: { fontSize: 18, paddingHorizontal: 8 },
  memoryEmpty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  memoryEmptyText: { fontSize: 13, color: '#BBB', textAlign: 'center', lineHeight: 20 },
  chatList: { padding: 16, flexGrow: 1 },
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  petRow: { justifyContent: 'flex-start' },
  petAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  petAvatarText: { fontSize: 18 },
  bubble: {
    maxWidth: '70%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: { backgroundColor: '#FF9F43', borderBottomRightRadius: 4 },
  petBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFF' },
  petText: { color: '#5A4A4A' },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#5A4A4A',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#FF9F43',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 60, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#999' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatEmoji: { fontSize: 50, marginBottom: 12 },
  emptyChatText: { fontSize: 14, color: '#BBB' },
});
