/**
 * 帽子AI宠物 - 后端入口（安全加固版）
 * 端口: 60235
 * 职责: AI 对话代理、用户数据、云存档、宠物事件
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { aiRouter } from './routes/ai';
import { petRouter } from './routes/pet';
import { socialRouter } from './routes/social';
import { inventoryRouter } from './routes/inventory';
import { authRouter } from './routes/auth';
import { shopRouter } from './routes/shop';
import { tasksRouter } from './routes/tasks';
import { achievementsRouter } from './routes/achievements';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '60235');

// 反向代理（Nginx）背后必须信任 X-Forwarded-For，
// 否则限流会把所有请求视为同一来源 IP，全站共享限额
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============================================================
// 安全中间件
// ============================================================

// CORS 限制（生产环境只允许指定域名）
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',');
app.use(cors({
  origin: allowedOrigins[0] === '*' ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 预检缓存 24 小时
}));

// 全局基础速率限制（可通过 RATE_LIMIT_MAX 环境变量调整，便于压测）
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 分钟
  max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
});
app.use(globalLimiter);

// AI 接口专属更严格限制
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10),
  message: { error: 'AI 对话请求过于频繁，请等一下喵~' },
});

// 请求体解析
app.use(express.json({ limit: '1mb' }));

// ============================================================
// 路由
// ============================================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '帽子AI宠物 - 后端',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// AI 路由加专属限速
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/pet', petRouter);
app.use('/api/social', socialRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/auth', authRouter);
app.use('/api/shop', shopRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/achievements', achievementsRouter);

// ============================================================
// 错误处理
// ============================================================

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'API 不存在' });
});

// 全局错误处理（防止泄露堆栈）
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
});

// ============================================================
// 启动
// ============================================================

const server = app.listen(PORT, () => {
  console.log(`🐱 帽子AI宠物后端已启动: http://localhost:${PORT}`);
  console.log(`📡 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS: ${allowedOrigins[0] === '*' ? '开发模式（全开）' : allowedOrigins.join(', ')}`);
});

// Graceful Shutdown
function shutdown(signal: string) {
  console.log(`🛑 收到 ${signal}，优雅关闭中...`);
  server.close(() => {
    console.log('✅ 服务已停止');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
