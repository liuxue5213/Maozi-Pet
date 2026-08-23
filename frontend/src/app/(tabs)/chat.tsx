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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { usePetStore } from '../../store/petStore';

export default function ChatScreen() {
  const { pet, chatHistory, sendMessage } = usePetStore();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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
          maxLength={200}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
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
