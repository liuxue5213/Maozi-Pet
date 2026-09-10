# 🐱 帽子AI宠物

> 轻压力 · AI 陪伴 · 可循环养成 · 治愈系虚拟宠物 APP

![封面](assets/images/banner.png)

---

## 📋 项目概述

一款区别于传统电子宠物的 AI 陪伴应用，主打「低压力真实陪伴 + 动态循环养成 + 人格化 AI 互动 + 无负担轻社交」。

**核心差异化：**
- 🤝 **互惠照顾**：你坚持现实中的好习惯，宠物陪你一起成长（Finch 式「照顾宠物=照顾自己」，对标 $30M ARR 的自我关怀赛道）
- 🚫 无死亡惩罚、无强制打卡、无高压衰减，断签不施压
- 🔄 宠物退休循环养成体系，无限玩法
- 🧠 5 种 AI 性格 + 宠物记忆系统，动态随机人生事件
- 🔥 习惯 streak 里程碑：连续打卡解锁宠物经验/限定徽章/钻石

---

## 🛠 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React Native + Expo (TypeScript) |
| 后端 | Node.js + Express (TypeScript) |
| AI | 阿里百炼 qwen-plus (OpenAI 兼容) |
| 状态 | Zustand |
| 推送 | Expo Push |
| 测试 | node:test（`npm test`，141 用例） |
| CI/CD | GitHub Actions |
| 服务器 | 阿里云 ECS |

---

## 📁 项目结构

```
maozi-pet/
├── .github/
│   ├── workflows/
│   │   ├── build.yml          # PR 构建检查（后端 + 前端 Web）
│   │   ├── deploy.yml         # 自动部署后端 + 前端 Web 到服务器
│   │   └── build-apk.yml      # 通过 EAS Build 云端打包 Android APK
│   └── SECRETS.md             # Secrets 配置指南
├── assets/
│   └── images/                # App 图标、封面、横幅
├── backend/                   # 后端服务
│   └── src/
│       ├── index.ts           # 入口（安全中间件、限流）
│       ├── db/index.ts        # SQLite 持久化层
│       ├── middleware/auth.ts # JWT 鉴权
│       ├── utils/             # 工具函数
│       └── routes/
│           ├── ai.ts          # AI 对话代理
│           ├── pet.ts         # 宠物数据
│           ├── auth.ts        # 用户系统
│           ├── shop.ts        # 商城 + 签到
│           ├── inventory.ts   # 背包/装扮/家园
│           ├── social.ts      # 社区 + 好友
│           └── habits.ts      # 习惯打卡 + streak 里程碑
├── frontend/                  # 前端应用
│   └── src/
│       ├── app/               # 页面路由（expo-router）
│       │   ├── (tabs)/        # 底部 Tab 页（家园/聊天/背包/社交/商城）
│       │   ├── login.tsx      # 登录/注册
│       │   ├── register.tsx   # 游客转正
│       │   ├── onboarding.tsx # 孵化引导
│       │   └── profile.tsx    # 个人资料
│       ├── store/             # 状态管理
│       ├── components/        # 公共组件
│       └── config/            # 环境配置
├── scripts/                   # 工具脚本
├── .env.example               # 环境变量模板
├── .gitignore
└── README.md
```

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- npm / yarn
- Expo CLI (前端开发)

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/your-username/maozi-pet.git
cd maozi-pet

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的百炼 API Key

# 3. 启动后端
cd backend
npm install
npm run dev
# 后端运行在 http://localhost:60235

# 4. 启动前端（新终端）
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:60230
```

---

## 🔄 版本规划

### V1.5（当前，2026-09-10 两夜冲刺 + 日间/夜间迭代后，共 20 轮）
- [x] 账号系统 + 云存档 + 隐私设置 + 头像选择器
- [x] 宠物属性体系 + 慢衰减 + **睡觉作息**（哄睡/叫醒/入睡锚点结算）+ 退休循环
- [x] AI 人格对话 + **宠物记忆系统**（自动提取/查看/遗忘/主动回忆/数据导出）+ AI 情绪外显
- [x] **每日任务**（3 任务 + 金币奖励）+ 新手礼包
- [x] **互动小游戏**：猜拳（输了也+心情）+ 猜数字（7 次机会/越快越多金币）
- [x] **习惯打卡**（现实习惯→宠物 +心情+金币，streak 外显）+ **streak 里程碑**（3/7/14/21 天→宠物经验+限定徽章+💎）+ **打卡提醒推送**（晚间窗口/streak 守护/每日 1 条）+ 无压力断签文案
- [x] **成就徽章**（17 枚，解锁自动发 💎）+ **钻石经济**（限定颜值商城）
- [x] **推送召回**（饿了/心情低落宠物叫你 + 免打扰时段，Expo Push）
- [x] 好友串门 + 点赞/送礼 + 家具摆放 + 删帖/真实头像/晒宠 + **发帖配图** + **站内通知中心**（未读红点）
- [x] **第四款小游戏「打地鼠」**（服务端权威防作弊）· 猜拳 · 猜数字 · 记忆翻牌
- [x] **习惯 streak 冻结券**（漏打 1 天自动桥接，Duolingo 式宽宥）
- [x] **纪念海报**（性格语录卡片 + 图片导出分享）
- [x] **数据主权**：记忆周报 · 记忆导出 · **全量账号数据导出（可携带权）** · **账号注销（可删除权）**
- [x] 宠物改名（长按名字）· 金秋限定装扮 · 成就 20 枚（💎100 收集闭环）
- [ ] 桌面小组件（V2.0）
- [ ] FCM 真机推送送达（需 google-services.json 配置）

### V2.0 迭代（+1月）
- [ ] 宠物繁育（遗传性格/配色）
- [ ] 更多装扮/场景（季节轮换）
- [ ] 通知推送打通（站内通知 → 可选 Expo Push）
- [ ] AI 预测性提醒时刻（需推送打开率数据积累）

### V3.0 长期运营
- [ ] 多人宠物派对
- [ ] 自定义宠物形象
- [ ] 季节剧情 + 气候效果

---

## 🔐 安全说明

- 所有 API Key、服务器密码通过 **GitHub Secrets** 注入
- 源码中不包含任何真实密钥
- `.env` 文件已被 `.gitignore` 排除
- 详见 [.github/SECRETS.md](.github/SECRETS.md)

---

## 📄  License

MIT License
