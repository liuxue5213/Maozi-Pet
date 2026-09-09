/**
 * 帽子AI宠物 - SQLite 持久化层
 * 替换内存 Map，确保服务重启数据不丢失
 */
import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据目录不存在则创建
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(path.join(DATA_DIR, 'maozi-pet.db'));

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// 事务工具（保证多步操作原子性）
// ============================================================

/**
 * 执行事务：多步数据库操作要么全部成功，要么全部回滚
 * @param fn 事务函数，接收 db 实例执行操作
 * @returns 事务返回值
 */
export function transaction<T>(fn: (db: DatabaseType) => T): T {
  const txn = db.transaction(fn);
  return txn(db);
}

// ============================================================
// 初始化表结构
// ============================================================

db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'guest',
    nickname TEXT NOT NULL DEFAULT '铲屎官',
    email TEXT UNIQUE,
    password_hash TEXT,
    avatar_emoji TEXT DEFAULT '🐱',
    bio TEXT DEFAULT '',
    privacy_show_on_square INTEGER NOT NULL DEFAULT 1,
    privacy_allow_stranger INTEGER NOT NULL DEFAULT 1,
    privacy_hide_pet_info INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 100,
    diamonds INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  -- 宠物表
  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '帽子',
    personality TEXT NOT NULL DEFAULT 'cute',
    stage TEXT NOT NULL DEFAULT 'egg',
    level INTEGER NOT NULL DEFAULT 1,
    exp INTEGER NOT NULL DEFAULT 0,
    stats_hunger INTEGER NOT NULL DEFAULT 100,
    stats_cleanliness INTEGER NOT NULL DEFAULT 100,
    stats_mood INTEGER NOT NULL DEFAULT 100,
    stats_energy INTEGER NOT NULL DEFAULT 100,
    stats_health INTEGER NOT NULL DEFAULT 100,
    appearance TEXT NOT NULL DEFAULT '{}',
    total_interactions INTEGER NOT NULL DEFAULT 0,
    is_retired INTEGER NOT NULL DEFAULT 0,
    is_sleeping INTEGER NOT NULL DEFAULT 0,
    sleep_started_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 聊天历史表
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  );

  -- 令牌表（JWT 签发记录，支持失效）
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 好友关系表
  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
  );

  -- 社区帖子表
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    pet_id TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE SET NULL
  );

  -- 点赞表
  CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
  );

  -- 评论表
  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- 好友托管授权表
  CREATE TABLE IF NOT EXISTS pet_care_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    caregiver_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    UNIQUE(owner_id, caregiver_id, pet_id)
  );

  -- 装扮/物品定义表
  CREATE TABLE IF NOT EXISTS item_defs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    price_coins INTEGER DEFAULT 0,
    rarity TEXT NOT NULL DEFAULT 'common',
    is_limited INTEGER NOT NULL DEFAULT 0,
    shop_category TEXT NOT NULL DEFAULT 'decoration',
    sort_order INTEGER DEFAULT 0
  );

  -- 用户拥有物品表
  CREATE TABLE IF NOT EXISTS user_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    acquired_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item_defs(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id)
  );

  -- 宠物装备表
  CREATE TABLE IF NOT EXISTS pet_equips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    item_id TEXT NOT NULL,
    equipped_at TEXT NOT NULL,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    UNIQUE(pet_id, slot)
  );

  -- 家园场景表
  CREATE TABLE IF NOT EXISTS home_scenes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    background_color TEXT NOT NULL DEFAULT '#FFF5F7',
    icon TEXT NOT NULL DEFAULT '🏠',
    price_coins INTEGER DEFAULT 0,
    is_default INTEGER NOT NULL DEFAULT 0
  );

  -- 用户家园表
  CREATE TABLE IF NOT EXISTS user_homes (
    user_id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL DEFAULT 'cozy_room',
    wallpaper_id TEXT,
    furniture TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES home_scenes(id)
  );

  -- 图鉴收集记录
  CREATE TABLE IF NOT EXISTS collection_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_id)
  );

  -- 索引优化
  CREATE INDEX IF NOT EXISTS idx_pets_user_id ON pets(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_pet_id ON chat_messages(pet_id);
  CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_tokens_expires ON auth_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
  CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_user_items_user ON user_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_pet_equips_pet ON pet_equips(pet_id);

  -- 签到记录表
  CREATE TABLE IF NOT EXISTS checkin_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    streak_day INTEGER NOT NULL,
    reward_coins INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, checkin_date)
  );

  -- 每日互动统计表（防刷金币）
  CREATE TABLE IF NOT EXISTS daily_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    interaction_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    coins_earned INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, interaction_date)
  );

  -- 每日互动索引（放在表创建之后）
  CREATE INDEX IF NOT EXISTS idx_daily_interactions_user_date ON daily_interactions(user_id, interaction_date);

  -- 每日 AI 调用计数（chat + event 统一防刷，与 petId 无关）
  CREATE TABLE IF NOT EXISTS daily_chat (
    user_id TEXT NOT NULL,
    chat_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, chat_date)
  );

  -- 用户已购家园场景（防止切换场景重复扣费）
  CREATE TABLE IF NOT EXISTS user_scene_owns (
    user_id TEXT NOT NULL,
    scene_id TEXT NOT NULL,
    purchased_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES home_scenes(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, scene_id)
  );

  -- 宠物记忆（AI 对话中提取的关于主人的事实，注入人设实现个性化）
  CREATE TABLE IF NOT EXISTS pet_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    UNIQUE(user_id, pet_id, content)
  );
  CREATE INDEX IF NOT EXISTS idx_memories_pet ON pet_memories(pet_id, created_at);

  -- 每日任务进度（按自然日刷新，领取标记防重复）
  CREATE TABLE IF NOT EXISTS task_progress (
    user_id TEXT NOT NULL,
    task_date TEXT NOT NULL,
    task_id TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, task_date, task_id)
  );

  -- 猜拳每日统计（局数上限 + 胜次，按自然日刷新）
  CREATE TABLE IF NOT EXISTS rps_daily (
    user_id TEXT NOT NULL,
    game_date TEXT NOT NULL,
    play_count INTEGER NOT NULL DEFAULT 0,
    win_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, game_date)
  );

  -- 好友串门互动记录（每天每宠物每类型限一次，防刷属性）
  CREATE TABLE IF NOT EXISTS friend_visit_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    type TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (visitor_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(visitor_id, pet_id, type, visit_date)
  );
  CREATE INDEX IF NOT EXISTS idx_visit_interactions_owner ON friend_visit_interactions(owner_id, visit_date);

  -- 成就徽章（解锁后永久保留，跨宠物存在）
  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  );

  -- 推送令牌（一个用户可有多台设备；token 全局唯一防重复注册）
  CREATE TABLE IF NOT EXISTS push_tokens (
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

  -- 推送防骚扰记录（每宠物每类型每天最多一条）
  CREATE TABLE IF NOT EXISTS push_sent (
    pet_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_date TEXT NOT NULL,
    PRIMARY KEY (pet_id, kind, sent_date)
  );

  -- 猜数字：进行中对局（谜底存服务端防作弊；一人同时最多一局活跃）
  CREATE TABLE IF NOT EXISTS guess_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    pet_id TEXT NOT NULL,
    secret INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 7,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_guess_sessions_user_status ON guess_sessions(user_id, status);

  -- 猜数字：每日局数统计
  CREATE TABLE IF NOT EXISTS guess_daily (
    user_id TEXT NOT NULL,
    game_date TEXT NOT NULL,
    game_count INTEGER NOT NULL DEFAULT 0,
    win_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, game_date)
  );
`);

// ============================================================
// 轻量列迁移：老库补新列（幂等）
// ============================================================

function ensureColumn(table: string, column: string, ddl: string): void {
  const cols = (db.pragma(`table_info(${table})`) as any[]).map((c: any) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// 睡觉作息系统（Round 8）
ensureColumn('pets', 'is_sleeping', 'is_sleeping INTEGER NOT NULL DEFAULT 0');
ensureColumn('pets', 'sleep_started_at', 'sleep_started_at TEXT');

// ============================================================
// 初始数据：装扮物品 + 家园场景
// ============================================================

// 商城商品（只卖颜值，不卖数值）
const ITEM_DEFS = [
  // === 装扮-头饰 ===
  { id: 'hat_flower', name: '小花环', category: 'hat', icon: '🌸', description: '春天的气息', price_coins: 30, rarity: 'common', shop_category: 'decoration', sort_order: 1 },
  { id: 'hat_beanie', name: '针织帽', category: 'hat', icon: '🧶', description: '温暖的小帽子', price_coins: 50, rarity: 'common', shop_category: 'decoration', sort_order: 2 },
  { id: 'hat_antenna', name: '天线头饰', category: 'hat', icon: '📡', description: '接收宇宙信号', price_coins: 80, rarity: 'rare', shop_category: 'decoration', sort_order: 3 },
  { id: 'hat_tophat', name: '高礼帽', category: 'hat', icon: '🎩', description: '优雅绅士风', price_coins: 100, rarity: 'rare', shop_category: 'decoration', sort_order: 4 },
  { id: 'hat_crown', name: '小皇冠', category: 'hat', icon: '👑', description: '猫中贵族', price_coins: 200, rarity: 'epic', shop_category: 'decoration', sort_order: 5 },
  { id: 'hat_santa', name: '圣诞帽', category: 'hat', icon: '🎅', description: '圣诞节限定', price_coins: 150, rarity: 'rare', shop_category: 'decoration', sort_order: 6, is_limited: 1 },

  // === 装扮-衣服 ===
  { id: 'cloth_tshirt', name: 'T恤', category: 'clothing', icon: '👕', description: '休闲舒适', price_coins: 40, rarity: 'common', shop_category: 'decoration', sort_order: 7 },
  { id: 'cloth_sweater', name: '毛衣', category: 'clothing', icon: '🧥', description: '温暖毛衣', price_coins: 80, rarity: 'common', shop_category: 'decoration', sort_order: 8 },
  { id: 'cloth_dress', name: '小裙子', category: 'clothing', icon: '👗', description: '美美的连衣裙', price_coins: 120, rarity: 'rare', shop_category: 'decoration', sort_order: 9 },
  { id: 'cloth_superhero', name: '超人披风', category: 'clothing', icon: '🦸', description: '喵喵侠出动！', price_coins: 300, rarity: 'epic', shop_category: 'decoration', sort_order: 10 },
  { id: 'cloth_kimono', name: '和风浴衣', category: 'clothing', icon: '👘', description: '夏日祭典限定', price_coins: 180, rarity: 'rare', shop_category: 'decoration', sort_order: 11, is_limited: 1 },

  // === 装扮-配饰 ===
  { id: 'acc_bow', name: '蝴蝶结', category: 'accessory', icon: '🎀', description: '可爱蝴蝶结', price_coins: 20, rarity: 'common', shop_category: 'decoration', sort_order: 12 },
  { id: 'acc_necklace', name: '小铃铛', category: 'accessory', icon: '🔔', description: '走路叮当响', price_coins: 40, rarity: 'common', shop_category: 'decoration', sort_order: 13 },
  { id: 'acc_glasses', name: '墨镜', category: 'accessory', icon: '🕶️', description: '酷酷的墨镜', price_coins: 60, rarity: 'common', shop_category: 'decoration', sort_order: 14 },
  { id: 'acc_scarf', name: '围巾', category: 'accessory', icon: '🧣', description: '暖暖的围巾', price_coins: 50, rarity: 'common', shop_category: 'decoration', sort_order: 15 },
  { id: 'acc_bowtie', name: '小领结', category: 'accessory', icon: '🎗️', description: '绅士风度', price_coins: 70, rarity: 'rare', shop_category: 'decoration', sort_order: 16 },

  // === 特效光环 ===
  { id: 'effect_heart', name: '爱心气泡', category: 'effect', icon: '💕', description: '爱心满满', price_coins: 80, rarity: 'common', shop_category: 'effect', sort_order: 17 },
  { id: 'effect_stars', name: '星星环绕', category: 'effect', icon: '✨', description: '闪闪星星', price_coins: 100, rarity: 'rare', shop_category: 'effect', sort_order: 18 },
  { id: 'effect_rainbow', name: '彩虹光环', category: 'effect', icon: '🌈', description: '彩虹围绕', price_coins: 150, rarity: 'rare', shop_category: 'effect', sort_order: 19 },
  { id: 'effect_fire', name: '火焰特效', category: 'effect', icon: '🔥', description: '火力全开', price_coins: 250, rarity: 'epic', shop_category: 'effect', sort_order: 20 },
  { id: 'effect_sakura', name: '樱花飘落', category: 'effect', icon: '🌸', description: '落英缤纷', price_coins: 180, rarity: 'rare', shop_category: 'effect', sort_order: 21, is_limited: 1 },
  { id: 'effect_snow', name: '雪花飘飘', category: 'effect', icon: '❄️', description: '冬日浪漫', price_coins: 180, rarity: 'rare', shop_category: 'effect', sort_order: 22, is_limited: 1 },

  // === 宠物皮肤（花色） ===
  { id: 'skin_tabby', name: '虎斑猫', category: 'skin', icon: '🐯', description: '威风凛凛的虎斑', price_coins: 150, rarity: 'rare', shop_category: 'skin', sort_order: 23 },
  { id: 'skin_siamese', name: '暹罗猫', category: 'skin', icon: '🤎', description: '优雅的暹罗', price_coins: 150, rarity: 'rare', shop_category: 'skin', sort_order: 24 },
  { id: 'skin_calico', name: '三花猫', category: 'skin', icon: '🎨', description: '招财三花', price_coins: 200, rarity: 'epic', shop_category: 'skin', sort_order: 25 },
  { id: 'skin_white', name: '纯白猫', category: 'skin', icon: '🤍', description: '纯洁如雪', price_coins: 120, rarity: 'common', shop_category: 'skin', sort_order: 26 },
  { id: 'skin_black', name: '黑猫', category: 'skin', icon: '🖤', description: '神秘黑猫', price_coins: 120, rarity: 'common', shop_category: 'skin', sort_order: 27 },

  // === 头像框 ===
  { id: 'frame_heart', name: '爱心框', category: 'frame', icon: '💖', description: '爱心围绕', price_coins: 60, rarity: 'common', shop_category: 'frame', sort_order: 28 },
  { id: 'frame_star', name: '星星框', category: 'frame', icon: '⭐', description: '星光闪耀', price_coins: 80, rarity: 'common', shop_category: 'frame', sort_order: 29 },
  { id: 'frame_flame', name: '火焰框', category: 'frame', icon: '🔥', description: '热血燃烧', price_coins: 120, rarity: 'rare', shop_category: 'frame', sort_order: 30 },
  { id: 'frame_diamond', name: '钻石框', category: 'frame', icon: '💎', description: '尊贵奢华', price_coins: 200, rarity: 'epic', shop_category: 'frame', sort_order: 31 },
  { id: 'frame_rainbow', name: '彩虹框', category: 'frame', icon: '🌈', description: '缤纷彩虹', price_coins: 150, rarity: 'rare', shop_category: 'frame', sort_order: 32 },

  // === 聊天气泡 ===
  { id: 'bubble_pink', name: '粉嫩气泡', category: 'bubble', icon: '💗', description: '甜美粉色', price_coins: 50, rarity: 'common', shop_category: 'bubble', sort_order: 33 },
  { id: 'bubble_star', name: '星星气泡', category: 'bubble', icon: '🌟', description: '闪闪发光', price_coins: 80, rarity: 'common', shop_category: 'bubble', sort_order: 34 },
  { id: 'bubble_cat', name: '猫咪气泡', category: 'bubble', icon: '🐾', description: '爪印气泡', price_coins: 100, rarity: 'rare', shop_category: 'bubble', sort_order: 35 },
  { id: 'bubble_heart', name: '爱心气泡', category: 'bubble', icon: '💝', description: '满满爱意', price_coins: 120, rarity: 'rare', shop_category: 'bubble', sort_order: 36 },
  // === 家园家具（shop_category=furniture：购买后可在背包-家园里摆放） ===
  { id: 'fur_candle', name: '香薰蜡烛', category: 'furniture', icon: '🕯️', description: '安神的味道', price_coins: 40, rarity: 'common', shop_category: 'furniture', sort_order: 37 },
  { id: 'fur_basket', name: '收纳篮', category: 'furniture', icon: '🧺', description: '毛线球的家', price_coins: 50, rarity: 'common', shop_category: 'furniture', sort_order: 38 },
  { id: 'fur_plant', name: '绿植盆栽', category: 'furniture', icon: '🪴', description: '一抹生机', price_coins: 60, rarity: 'common', shop_category: 'furniture', sort_order: 39 },
  { id: 'fur_bed', name: '舒软猫窝', category: 'furniture', icon: '🛏️', description: '睡个好朋友', price_coins: 90, rarity: 'common', shop_category: 'furniture', sort_order: 40 },
  { id: 'fur_bookshelf', name: '小书架', category: 'furniture', icon: '📚', description: '陪你读书', price_coins: 100, rarity: 'rare', shop_category: 'furniture', sort_order: 41 },
  { id: 'fur_sofa', name: '小沙发', category: 'furniture', icon: '🛋️', description: '一起瘫着', price_coins: 120, rarity: 'rare', shop_category: 'furniture', sort_order: 42 },
  { id: 'fur_guitar', name: '小吉他', category: 'furniture', icon: '🎸', description: '偶尔弹一首', price_coins: 150, rarity: 'epic', shop_category: 'furniture', sort_order: 43 },
];

// 家园场景
const HOME_SCENES = [
  { id: 'cozy_room', name: '温馨小屋', description: '温暖的小家', background_color: '#FFF5F7', icon: '🏠', is_default: 1 },
  { id: 'garden', name: '户外草坪', description: '阳光草地', background_color: '#E8F8E8', icon: '🌳', price_coins: 100 },
  { id: 'beach', name: '海边沙滩', description: '听海浪的声音', background_color: '#E8F4FF', icon: '🏖️', price_coins: 200 },
  { id: 'starry', name: '星空房', description: '满天星星的夜晚', background_color: '#EDE8FF', icon: '🌌', price_coins: 300 },
  { id: 'bamboo', name: '竹林小院', description: '清幽竹林', background_color: '#F0FFF0', icon: '🎋', price_coins: 250 },
];

// 商品插入（幂等）
const insertItem = db.prepare(`
  INSERT OR IGNORE INTO item_defs (id, name, category, icon, description, price_coins, rarity, is_limited, shop_category, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
ITEM_DEFS.forEach(item => {
  insertItem.run(item.id, item.name, item.category, item.icon, item.description, item.price_coins, item.rarity, item.is_limited || 0, item.shop_category, item.sort_order);
});

// 家园场景插入（幂等）
// 注意：is_default 列为 NOT NULL，必须显式传 0，
// 否则 undefined 会被绑定为 NULL 并被 INSERT OR IGNORE 静默跳过
const insertScene = db.prepare(`
  INSERT OR IGNORE INTO home_scenes (id, name, description, background_color, icon, price_coins, is_default)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
HOME_SCENES.forEach(scene => {
  insertScene.run(scene.id, scene.name, scene.description, scene.background_color, scene.icon, scene.price_coins ?? 0, scene.is_default ?? 0);
});

export { ITEM_DEFS, HOME_SCENES };

export default db;
