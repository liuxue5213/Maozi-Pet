/**
 * 帽子AI宠物 - 环境变量配置（安全 + 持久化）
 * 生产环境变量由 GitHub Actions 构建时注入
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API 地址（构建时注入或本地开发）
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'http://localhost:60235/api';

export const ENV = {
  apiBaseUrl,
  isDev: __DEV__,
  isProd: !__DEV__,
  appName: '帽子AI宠物',
  appVersion: '1.0.0',
};

// ============================================================
// Token 管理（持久化到 AsyncStorage）
// ============================================================

const TOKEN_KEY = 'maozi_pet_token';

let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ============================================================
// API 请求封装（自动带 Token + 统一错误处理）
// ============================================================

// 认证相关端点：401 表示"账号密码错误"等业务错误，
// 不应触发"清除 Token + 登录已过期"的拦截逻辑
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/guest', '/auth/upgrade'];

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${ENV.apiBaseUrl}${path}`;
  const token = await getToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // 自动附加 Token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeout);

    // Token 过期/失效 → 清除并提示（认证端点除外）
    if (response.status === 401 && !AUTH_PATHS.some(p => path.startsWith(p))) {
      await clearToken();
      throw new Error('登录已过期，请重新登录');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('网络超时，请检查网络连接');
    }
    throw error;
  }
}
