/**
 * 帽子AI宠物 - 社交模块子导航
 * 广场 / 好友 两个 Tab
 */
import { Tabs } from 'expo-router';

export default function SocialLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // 用自定义顶部 Tab 替代
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="friends" />
    </Tabs>
  );
}
