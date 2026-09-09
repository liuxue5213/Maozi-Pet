# 🐱 帽子AI宠物

> 轻压力 · AI 陪伴 · 可循环养成 · 治愈系虚拟宠物 APP

![封面](assets/images/banner.png)

---

## 📋 项目概述

一款区别于传统电子宠物的 AI 陪伴应用，主打「低压力真实陪伴 + 动态循环养成 + 人格化 AI 互动 + 无负担轻社交」。

**核心差异化：**
- 🚫 无死亡惩罚、无强制打卡、无高压衰减
- 🔄 宠物退休循环养成体系，无限玩法
- 🧠 5 种 AI 性格，动态随机人生事件
- 📱 桌面小组件 + 碎片化触达

---

## 🛠 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | React Native + Expo (TypeScript) |
| 后端 | Node.js + Express (TypeScript) |
| AI | 阿里百炼 qwen-plus (OpenAI 兼容) |
| 状态 | Zustand |
| 推送 | Expo Push |
| 测试 | node:test（`npm test`，42 用例） |
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
│           └── social.ts      # 社区 + 好友
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

### V1.5（当前，2026-09 凌晨迭代后）
- [x] 账号系统 + 云存档 + 隐私设置
- [x] 宠物属性体系 + 慢衰减 + 退休循环
- [x] AI 人格对话 + **宠物记忆系统**（自动提取/查看/遗忘/主动回忆/数据导出）
- [x] **每日任务**（3 任务 + 金币奖励，留存闭环）
- [x] **互动小游戏**：猜拳（每日 20 局，输了也+心情）
- [x] **成就徽章**（13 枚，惰性评估）
- [x] **推送召回**（饿了/心情低落时宠物主动叫你，Expo Push）
- [x] 好友串门 + 点赞/送礼互动
- [ ] 海报分享（后端 API 已就绪，前端未接）
- [ ] 桌面小组件（未实现）

### V2.0 迭代（+1月）
- [ ] 社区广场完善（发帖配图）
- [ ] 宠物繁育
- [ ] 更多装扮/场景
- [ ] 记忆日记周报分享

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
