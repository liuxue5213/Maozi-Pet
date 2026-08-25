/**
 * 帽子AI宠物 - 社交路由
 * 社区广场：发帖、浏览、点赞、评论
 * 好友系统：添加好友、好友列表、串门
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { transaction } from '../db';
import { authMiddleware, getCurrentUserId } from '../middleware/auth';

export const socialRouter = Router();

// ============================================================
// 类型
// ============================================================

interface PostRow {
  id: number;
  user_id: string;
  pet_id: string | null;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  // JOIN 字段
  author_nickname?: string;
  author_type?: string;
  pet_name?: string;
  pet_stage?: string;
  pet_personality?: string;
}

interface CommentRow {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
  author_nickname?: string;
}

// ============================================================
// 社区广场 - 帖子
// ============================================================

// 解析帖子 ID（路由参数必须是正整数）
function parsePostId(req: Request): number | null {
  const id = parseInt(req.params.postId, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// LIKE 关键词转义（% _ \ 是通配符）
function escapeLike(keyword: string): string {
  return keyword.replace(/[\\%_]/g, ch => '\\' + ch);
}

// 获取帖子列表（广场动态流，尊重用户"广场展示"隐私设置）
socialRouter.get('/posts', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
  const offset = (page - 1) * pageSize;

  // 获取帖子 + 作者信息 + 宠物信息（过滤掉关闭广场展示的用户）
  const posts = db.prepare(`
    SELECT p.*,
      u.nickname as author_nickname, u.type as author_type,
      pt.name as pet_name, pt.stage as pet_stage, pt.personality as pet_personality
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN pets pt ON p.pet_id = pt.id
    WHERE COALESCE(u.privacy_show_on_square, 1) = 1
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset) as PostRow[];

  // 一次性查出当前用户已点赞的帖子（避免逐条查询）
  const postIds = posts.map(p => p.id);
  const likedSet = new Set<number>();
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',');
    (db.prepare(`SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${placeholders})`)
      .all(userId, ...postIds) as any[]).forEach(r => likedSet.add(r.post_id));
  }

  const result = posts.map(post => ({
    id: post.id,
    content: post.content,
    imageUrl: post.image_url,
    likesCount: post.likes_count,
    commentsCount: post.comments_count,
    createdAt: post.created_at,
    author: {
      id: post.user_id,
      nickname: post.author_nickname,
      type: post.author_type,
    },
    pet: post.pet_id ? {
      id: post.pet_id,
      name: post.pet_name,
      stage: post.pet_stage,
      personality: post.pet_personality,
    } : null,
    isLiked: likedSet.has(post.id),
  }));

  const total = (db.prepare(`
    SELECT COUNT(*) as cnt FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE COALESCE(u.privacy_show_on_square, 1) = 1
  `).get() as any).cnt;

  res.json({
    posts: result,
    pagination: {
      page,
      pageSize,
      total,
      hasMore: offset + pageSize < total,
    },
  });
});

// 发布帖子
socialRouter.post('/posts', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { content, imageUrl, petId } = req.body;

  // 验证
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: '内容不能为空' });
    return;
  }
  if (content.length > 500) {
    res.status(400).json({ error: '内容最多 500 字符' });
    return;
  }

  // 验证宠物归属
  if (petId) {
    const pet = db.prepare('SELECT id FROM pets WHERE id = ? AND user_id = ?').get(petId, userId);
    if (!pet) {
      res.status(403).json({ error: '只能关联自己的宠物' });
      return;
    }
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO posts (user_id, pet_id, content, image_url, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, petId || null, content.trim(), imageUrl || null, now);

  const newPost = db.prepare(`
    SELECT p.*,
      u.nickname as author_nickname, u.type as author_type,
      pt.name as pet_name, pt.stage as pet_stage
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN pets pt ON p.pet_id = pt.id
    WHERE p.id = ?
  `).get(result.lastInsertRowid) as PostRow;

  res.status(201).json({
    post: {
      id: newPost.id,
      content: newPost.content,
      imageUrl: newPost.image_url,
      likesCount: 0,
      commentsCount: 0,
      createdAt: newPost.created_at,
      author: { id: newPost.user_id, nickname: newPost.author_nickname },
      pet: newPost.pet_id ? { id: newPost.pet_id, name: newPost.pet_name, stage: newPost.pet_stage } : null,
      isLiked: false,
    },
    message: '发布成功！',
  });
});

// 点赞/取消点赞
socialRouter.post('/posts/:postId/like', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const postId = parsePostId(req);
  if (postId === null) {
    res.status(400).json({ error: '无效的帖子 ID' });
    return;
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) {
    res.status(404).json({ error: '帖子不存在' });
    return;
  }

  const existing = db.prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);

  const now = new Date().toISOString();

  if (existing) {
    // 取消点赞（事务保证原子性）
    transaction((tx) => {
      tx.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, userId);
      tx.prepare('UPDATE posts SET likes_count = likes_count - 1 WHERE id = ?').run(postId);
    });
    res.json({ isLiked: false, message: '已取消点赞' });
  } else {
    // 点赞（事务保证原子性）
    transaction((tx) => {
      tx.prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)').run(postId, userId, now);
      tx.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
    });
    res.json({ isLiked: true, message: '点赞成功' });
  }
});

// 获取评论列表
socialRouter.get('/posts/:postId/comments', authMiddleware, (req: Request, res: Response) => {
  const postId = parsePostId(req);
  if (postId === null) {
    res.status(400).json({ error: '无效的帖子 ID' });
    return;
  }
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

  const comments = db.prepare(`
    SELECT c.*, u.nickname as author_nickname
    FROM post_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    LIMIT ?
  `).all(postId, limit) as CommentRow[];

  res.json({
    comments: comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: { id: c.user_id, nickname: c.author_nickname },
    })),
  });
});

// 发表评论
socialRouter.post('/posts/:postId/comments', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const postId = parsePostId(req);
  if (postId === null) {
    res.status(400).json({ error: '无效的帖子 ID' });
    return;
  }
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: '评论内容不能为空' });
    return;
  }
  if (content.length > 200) {
    res.status(400).json({ error: '评论最多 200 字符' });
    return;
  }

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) {
    res.status(404).json({ error: '帖子不存在' });
    return;
  }

  const now = new Date().toISOString();
  let commentId: number | bigint;
  // 事务：写评论 + 更新计数（原子操作）
  transaction((tx) => {
    const result = tx.prepare(`
      INSERT INTO post_comments (post_id, user_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(postId, userId, content.trim(), now);
    commentId = result.lastInsertRowid;
    tx.prepare('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?').run(postId);
  });

  const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(userId) as any;

  res.status(201).json({
    comment: {
      id: commentId!,
      content: content.trim(),
      createdAt: now,
      author: { id: userId, nickname: user?.nickname },
    },
    message: '评论成功',
  });
});

// ============================================================
// 好友系统
// ============================================================

// 搜索用户（通过昵称）
socialRouter.get('/friends/search', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const keyword = (req.query.q as string || '').trim();

  if (keyword.length < 1) {
    res.status(400).json({ error: '请输入搜索关键词' });
    return;
  }

  const users = db.prepare(`
    SELECT id, nickname, type FROM users
    WHERE id != ? AND nickname LIKE ? ESCAPE '\\'
    LIMIT 20
  `).all(userId, `%${escapeLike(keyword)}%`) as any[];

  // 标记是否已是好友
  const result = users.map((u: any) => ({
    id: u.id,
    nickname: u.nickname,
    type: u.type,
    isFriend: !!db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, u.id),
  }));

  res.json({ users: result });
});

// 添加好友（双向）
socialRouter.post('/friends/add', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { friendId } = req.body;

  if (!friendId || friendId === userId) {
    res.status(400).json({ error: '无效的好友 ID' });
    return;
  }

  const friend = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(friendId);
  if (!friend) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  const existing = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  if (existing) {
    res.status(400).json({ error: '已经是好友了' });
    return;
  }

  const now = new Date().toISOString();
  // 双向添加（事务保证两条记录同时写入，避免产生单向好友）
  try {
    transaction((tx) => {
      tx.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(userId, friendId, now);
      tx.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(friendId, userId, now);
    });
  } catch (err: any) {
    if (typeof err.message === 'string' && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: '已经是好友了' });
      return;
    }
    throw err;
  }

  res.json({ message: `已添加 ${(friend as any).nickname} 为好友！` });
});

// 获取好友列表
socialRouter.get('/friends', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);

  const friends = db.prepare(`
    SELECT u.id, u.nickname, u.type, f.created_at
    FROM friendships f
    JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId) as any[];

  res.json({
    friends: friends.map((f: any) => ({
      id: f.id,
      nickname: f.nickname,
      type: f.type,
      friendsSince: f.created_at,
    })),
  });
});

// 串门：查看好友的宠物和家园
socialRouter.get('/friends/:friendId/visit', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const friendId = req.params.friendId;

  // 验证好友关系
  const friendship = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  if (!friendship) {
    res.status(403).json({ error: '只能访问好友的家园' });
    return;
  }

  const friend = db.prepare('SELECT id, nickname, type, privacy_hide_pet_info FROM users WHERE id = ?').get(friendId) as any;
  if (!friend) {
    res.status(404).json({ error: '好友不存在' });
    return;
  }

  // 获取好友的活跃宠物
  const pets = db.prepare(`
    SELECT id, name, personality, stage, level,
      stats_hunger, stats_cleanliness, stats_mood, stats_energy, stats_health
    FROM pets
    WHERE user_id = ? AND is_retired = 0
  `).all(friendId) as any[];

  res.json({
    friend: {
      id: friend.id,
      nickname: friend.nickname,
      type: friend.type,
    },
    pets: friend.privacy_hide_pet_info ? [] : pets.map((p: any) => ({
      id: p.id,
      name: p.name,
      personality: p.personality,
      stage: p.stage,
      level: p.level,
      stats: {
        hunger: p.stats_hunger,
        cleanliness: p.stats_cleanliness,
        mood: p.stats_mood,
        energy: p.stats_energy,
        health: p.stats_health,
      },
    })),
    canInteract: true, // 可以投喂小礼物等
  });
});

// 授权好友托管宠物（长期离线时）
socialRouter.post('/friends/care-grant', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { friendId, petId } = req.body;

  // 验证好友关系
  const friendship = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
  if (!friendship) {
    res.status(403).json({ error: '只能授权给好友' });
    return;
  }

  // 验证宠物归属
  const pet = db.prepare('SELECT id FROM pets WHERE id = ? AND user_id = ? AND is_retired = 0').get(petId, userId);
  if (!pet) {
    res.status(403).json({ error: '无效的宠物' });
    return;
  }

  const existing = db.prepare('SELECT 1 FROM pet_care_grants WHERE owner_id = ? AND caregiver_id = ? AND pet_id = ?').get(userId, friendId, petId);
  if (existing) {
    res.status(400).json({ error: '已授权该好友照料此宠物' });
    return;
  }

  db.prepare(`
    INSERT INTO pet_care_grants (owner_id, caregiver_id, pet_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, friendId, petId, new Date().toISOString());

  res.json({ message: '授权成功！好友可以帮你照料宠物了' });
});

// ============================================================
// 分享海报数据
// ============================================================

socialRouter.get('/poster/:petId', authMiddleware, (req: Request, res: Response) => {
  const userId = getCurrentUserId(req);
  const { petId } = req.params;

  const pet = db.prepare(`
    SELECT p.*, u.nickname as owner_nickname
    FROM pets p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ? AND p.user_id = ?
  `).get(petId, userId) as any;

  if (!pet) {
    res.status(404).json({ error: '宠物不存在' });
    return;
  }

  const daysOwned = Math.floor((Date.now() - new Date(pet.created_at).getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    poster: {
      petName: pet.name,
      personality: pet.personality,
      stage: pet.stage,
      level: pet.level,
      daysOwned: Math.max(daysOwned, 1),
      totalInteractions: pet.total_interactions,
      ownerNickname: pet.owner_nickname,
      // 随机生成一句专属语录
      quote: getPersonalityQuote(pet.personality, pet.name),
    },
  });
});

// 根据性格生成海报语录
function getPersonalityQuote(personality: string, name: string): string {
  const quotes: Record<string, string[]> = {
    cute: [`${name}今天也想和你贴贴喵~`, `有你陪着，${name}是最幸福的小猫！`, `${name}会一直一直陪着你的呢`],
    tsundere: [`哼，才...才不是想和你在一起呢！`, `${name}大人才离不开你呢，笨蛋！`, `别误会，${name}只是刚好在这里而已`],
    funny: [`${name}今天又在家里整活了哈哈哈`, `和主人在一起每天都是冒险！`, `${name}大人正在拯救世界（躺着）`],
    calm: [`岁月静好，有你相伴`, `${name}想和你安静地待在一起`, `谢谢你这么温柔地对待${name}`],
    cool: [`陪伴是最长情的告白`, `${name}不需要全世界，有你就好`, `猫生短暂，还好有你`],
  };
  const list = quotes[personality] || quotes.cute;
  return list[Math.floor(Math.random() * list.length)];
}
