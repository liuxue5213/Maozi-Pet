# 🔐 GitHub Secrets 配置指南

本文档说明需要在 GitHub 仓库中配置的 Secrets，**所有敏感信息都通过这里注入，不会出现在源码中**。

## 配置路径

GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

---

## 必需 Secrets

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `BAILIAN_API_KEY` | 阿里百炼 API Key | `sk-ws-H.EPRIYML.xxxxx` |
| `BAILIAN_BASE_URL` | 百炼 API 地址 | `https://llm-xxxxx.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| `BAILIAN_MODEL` | 模型名称（可选，默认 qwen-plus） | `qwen-plus` |
| `JWT_SECRET` | JWT 签名密钥（随机32位以上字符串） | `a1b2c3d4e5f6...` |
| `ALLOWED_ORIGINS` | CORS 允许域名 | `https://yourdomain.com` |
| `SERVER_HOST` | 服务器 IP | `<你的服务器IP>` |
| `SERVER_USER` | SSH 用户名 | `root` |
| `SERVER_PASSWORD` | SSH 密码 | `liuxue5213` |
| `SERVER_PORT` | SSH 端口（可选，默认22） | `22` |
| `PRODUCTION_API_URL` | 生产环境 API 地址 | `http://<你的服务器IP>:60235/api` |
| `EXPO_TOKEN` | Expo 访问令牌（用于 `build-apk.yml` 云端打包 Android APK） | `eyJ...`（在 expo.dev 账号设置页生成） |

---

## 🤖 APK 打包相关说明（build-apk.yml）

`build-apk.yml` 通过 **EAS Build** 云端构建 Android APK，需要额外准备：

1. 在 GitHub 仓库 Secrets 中配置 `EXPO_TOKEN`（Expo 官网 → 账号 → 访问令牌 生成）。
2. **首次使用前**在本地 `frontend/` 目录执行一次 `npx eas build:configure`，初始化 EAS 项目并关联账号。
3. 修改 `frontend/eas.json` 中 `preview` / `production` 的 `EXPO_PUBLIC_API_BASE_URL`：
   必须指向**真实服务器地址**（如 `https://<服务器IP>:60235/api`），否则打包出的 App 连不上后端。
4. 触发方式：在 Actions 页面手动 `Run workflow`，或推送 `v1.0.0` 这类 tag 自动触发。
5. 构建完成后，在 Actions 运行记录的 **Artifacts** 中下载 `maozi-pet.apk`。

> 注意：当前项目**没有**任何本地 Gradle / keystore 配置，APK 完全依赖 EAS 云端构建。
> `.gitignore` 已忽略 `*.apk *.aab`，产物仅通过 Actions Artifacts 分发，不入库。

---

## 可选 Secrets（后续扩展）

| Secret 名称 | 说明 |
|-------------|------|
| `ZHIPU_API_KEY` | 智谱图片生成 API Key（用于 CI 自动刷新图片） |
| `EXPO_ACCESS_TOKEN` | Expo 推送 Token |

---

## 安全规范

1. **永远不要** 将 API Key 硬编码在代码中
2. **永远不要** 将 `.env` 文件提交到 Git
3. 定期检查 Secrets 是否有泄露（GitHub 会邮件提醒）
4. 如怀疑泄露，立即在百炼控制台重新生成 API Key
