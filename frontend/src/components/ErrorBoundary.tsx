/**
 * 帽子AI宠物 - 全局错误边界
 * 防止组件报错导致白屏，提供友好恢复
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 开发环境打印，生产环境可上报
    console.error('ErrorBoundary 捕获错误:', error.message, errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😿</Text>
          <Text style={styles.title}>哎呀，小猫摔了一跤</Text>
          <Text style={styles.message}>
            {this.state.error?.message || '页面出了点小问题'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnText}>重新开始</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    padding: 40,
  },
  emoji: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#5A4A4A', marginBottom: 8 },
  message: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: '#FF9F43',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    ...Platform.select({
      ios: { shadowColor: '#FF9F43', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
