/**
 * 帽子AI宠物 - 根布局
 * 简单的 Stack + Tabs 结构，避免导航时序问题
 * 启动时检查登录态：无 Token 自动跳转登录页
 */
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getToken, registerPushNotifications } from '../config/env';

export default function RootLayout() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      setIsChecking(false);
      // 未登录（首次安装 / Token 被清除）→ 进入登录页
      if (!token) {
        router.replace('/login');
      } else {
        // 已登录：注册推送（宠物想你时会主动叫你），失败静默
        registerPushNotifications();
      }
    })();
  }, []);

  // 登录态检查期间显示启动占位，避免闪现主界面
  if (isChecking) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" backgroundColor="#FFF5F7" />
        <ActivityIndicator size="large" color="#FF9F43" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" backgroundColor="#FFF5F7" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFF5F7' },
          headerTitleStyle: { fontWeight: '600', color: '#5A4A4A' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#FFF5F7' },
        }}
      >
        {/* 主界面（带底部 Tabs） */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* 独立页面 */}
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: '孵化新宠物' }} />
        <Stack.Screen name="register" options={{ title: '注册正式账号' }} />
        <Stack.Screen name="archive" options={{ title: '宠物档案馆' }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
  },
});
