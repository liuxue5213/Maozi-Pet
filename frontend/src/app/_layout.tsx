/**
 * 帽子AI宠物 - 根布局
 * 简单的 Stack + Tabs 结构，避免导航时序问题
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
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
      </Stack>
    </ErrorBoundary>
  );
}
