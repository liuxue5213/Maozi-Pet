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
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePetStore } from '../../store/petStore';

export default function ChatScreen() {
  const { pet, chatHistory, sendMessage, loadHistory, memories, memoriesLoading, fetchMemories, forgetMemory } = usePetStore();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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
              <View style={styles.petAvatar}>
                <Text style={styles.petAvatarText}>🐱</Text>
              </View>
            )}
            <View style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.petBubble,
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
              <TouchableOpacity onPress={() => setShowMemories(false)}>
                <Text style={styles.modalClose}>完成</Text>
              </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
