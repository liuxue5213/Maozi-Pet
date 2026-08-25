/**
 * 帽子AI宠物 - 游客转正页
 * 将当前游客账号升级为正式账号（宠物、物品、金币全部保留）
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch, setToken, getToken } from '../config/env';
import { usePetStore } from '../store/petStore';

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 6 && password.length <= 32;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 预填当前游客昵称
  useEffect(() => {
    const user = usePetStore.getState().user;
    if (user?.nickname) setNickname(user.nickname);
  }, []);

  const handleUpgrade = async () => {
    if (!email.trim() || !validateEmail(email.trim())) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (!password || !validatePassword(password)) {
      setError('密码需要 6-32 位字符');
      return;
    }

    const guestToken = await getToken();
    if (!guestToken) {
      setError('登录状态已失效，请重新进入');
      router.replace('/login');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ token: string; user: any; message: string }>('/auth/upgrade', {
        method: 'POST',
        body: JSON.stringify({
          guestToken,
          email: email.trim().toLowerCase(),
          password,
          nickname: nickname.trim() || undefined,
        }),
      });
      await setToken(result.token);
      usePetStore.getState().setAuth(result.user);
      router.back();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>✨</Text>
          <Text style={styles.title}>注册正式账号</Text>
          <Text style={styles.subtitle}>你的宠物、物品和金币都会保留</Text>
        </View>

        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>昵称（可选）</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="保持当前昵称"
              placeholderTextColor="#CCC"
              maxLength={20}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>邮箱</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#CCC"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>密码</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="6-32位密码"
              placeholderTextColor="#CCC"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleUpgrade} disabled={isLoading}>
            <Text style={styles.primaryBtnText}>{isLoading ? '注册中...' : '🎉 保留数据，完成注册'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.textBtn} onPress={() => router.back()}>
            <Text style={styles.textBtnText}>← 暂不注册</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: '#5A4A4A' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 6 },
  errorBar: {
    backgroundColor: '#FFF3F0',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: { fontSize: 13, color: '#C0392B', textAlign: 'center' },
  form: { width: '100%' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#777', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#444',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  primaryBtn: {
    backgroundColor: '#FF9F43',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#FF9F43', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  textBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  textBtnText: { fontSize: 14, color: '#999' },
});
