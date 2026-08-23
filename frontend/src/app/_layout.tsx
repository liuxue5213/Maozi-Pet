/**
 * 帽子AI宠物 - 根布局
 * 启动检查：已登录 → 主界面，未登录 → 登录页
 * 底部 Tabs 导航 + 全局 Error Boundary
 */
import { Tabs, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getToken } from '../config/env';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
    </View>
  );
}

// 启动守卫组件
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      const isAuthGroup = segments[0] === '(auth)';

      if (!token && !isAuthGroup) {
        // 未登录 → 跳转登录页
        router.replace('/login');
      } else if (token && isAuthGroup) {
        // 已登录但还在登录页 → 跳转首页
        router.replace('/');
      }
      setIsChecking(false);
    }
    checkAuth();
  }, [segments]);

  if (isChecking) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingEmoji}>🐱</Text>
        <ActivityIndicator size="large" color="#FF9F43" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <StatusBar style="dark" backgroundColor="#FFF5F7" />
      <AuthGuard>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: '#FFF5F7' },
            headerTitleStyle: { fontWeight: '600', color: '#5A4A4A' },
            headerShadowVisible: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: '#FF9F43',
            tabBarInactiveTintColor: '#BBB',
            tabBarShowLabel: true,
            tabBarLabelStyle: styles.tabLabel,
          }}
        >
          {/* 登录页（隐藏 Tab） */}
          <Tabs.Screen name="login" options={{ href: null, headerShown: false }} />

          {/* 隐藏子页面 Tab */}
          <Tabs.Screen name="onboarding" options={{ href: null }} />
          <Tabs.Screen name="social/friends" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />

          {/* 主 Tab 页面 */}
          <Tabs.Screen
            name="index"
            options={{
              title: '家园',
              headerShown: false,
              tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="chat"
            options={{
              title: '聊天',
              tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="inventory"
            options={{
              title: '背包',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🎒" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="social"
            options={{
              title: '社交',
              tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="shop"
            options={{
              title: '商城',
              tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
            }}
          />
        </Tabs>
      </AuthGuard>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
  },
  loadingEmoji: { fontSize: 48 },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconWrapActive: { backgroundColor: '#FFF0E0' },
  tabEmoji: { fontSize: 20, opacity: 0.6 },
  tabEmojiActive: { opacity: 1 },
});
