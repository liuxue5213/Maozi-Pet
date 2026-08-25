/**
 * 帽子AI宠物 - 登录/注册页
 * 支持：游客快速开始、邮箱注册、账号登录
 */
import React, { useState } from 'react';
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
import { apiFetch, setToken } from '../config/env';
import { usePetStore } from '../store/petStore';

type Mode = 'welcome' | 'login' | 'register';

// 前端表单验证
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 6 && password.length <= 32;
}

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 游客快速开始
  const handleGuest = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ token: string; user: any; message: string }>('/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ nickname: nickname || '铲屎官' }),
      });
      await setToken(result.token);
      // 同步全局用户状态（首页显示昵称/金币）
      usePetStore.getState().setAuth(result.user);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 登录
  const handleLogin = async () => {
    // 前端表单验证
    if (!email.trim() || !validateEmail(email.trim())) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (!password || !validatePassword(password)) {
      setError('密码需要 6-32 位字符');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ token: string; user: any; message: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      await setToken(result.token);
      usePetStore.getState().setAuth(result.user);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 注册
  const handleRegister = async () => {
    // 前端表单验证
    if (!nickname.trim()) {
      setError('请输入昵称');
      return;
    }
    if (!email.trim() || !validateEmail(email.trim())) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (!password || !validatePassword(password)) {
      setError('密码需要 6-32 位字符');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await apiFetch<{ token: string; user: any; message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, nickname: nickname.trim() || '铲屎官' }),
      });
      await setToken(result.token);
      usePetStore.getState().setAuth(result.user);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Logo + 标题 */}
        <View style={styles.header}>
          <Text style={styles.logo}>🐱</Text>
          <Text style={styles.title}>帽子AI宠物</Text>
          <Text style={styles.subtitle}>你的专属AI治愈伙伴</Text>
        </View>

        {/* 错误提示 */}
        {error ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 欢迎页 */}
        {mode === 'welcome' && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleGuest} disabled={isLoading}>
              <Text style={styles.primaryBtnText}>{isLoading ? '进入中...' : '🎁 游客快速开始'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>无需注册，即刻体验</Text>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>或</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('login')}>
              <Text style={styles.secondaryBtnText}>登录账号</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => setMode('register')}>
              <Text style={styles.textBtnText}>注册新账号</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 登录页 */}
        {mode === 'login' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>欢迎回来 👋</Text>

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
                placeholder="请输入密码"
                placeholderTextColor="#CCC"
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={isLoading}>
              <Text style={styles.primaryBtnText}>{isLoading ? '登录中...' : '登 录'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.textBtn} onPress={() => { setMode('welcome'); setError(''); }}>
              <Text style={styles.textBtnText}>← 返回</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 注册页 */}
        {mode === 'register' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>创建账号 ✨</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>昵称</Text>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="给你的新名字"
                placeholderTextColor="#CCC"
                maxLength={10}
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

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={isLoading}>
              <Text style={styles.primaryBtnText}>{isLoading ? '注册中...' : '注 册'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.textBtn} onPress={() => { setMode('welcome'); setError(''); }}>
              <Text style={styles.textBtnText}>← 返回</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>🐾 零压力 · 轻养成 · 真治愈</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 32, minHeight: '100%' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#5A4A4A' },
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
  formTitle: { fontSize: 22, fontWeight: '700', color: '#5A4A4A', marginBottom: 24, textAlign: 'center' },
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
  secondaryBtn: {
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF9F43',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#FF9F43' },
  textBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  textBtnText: { fontSize: 14, color: '#999' },
  hint: { fontSize: 12, color: '#BBB', textAlign: 'center', marginTop: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  dividerText: { fontSize: 12, color: '#CCC', paddingHorizontal: 16 },
  footer: { fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 40 },
});
