/**
 * 帽子AI宠物 - 社交状态管理
 * 社区广场：帖子、点赞、评论
 * 好友系统：好友列表、串门
 */
import { create } from 'zustand';
import { apiFetch } from '../config/env';

// ============================================================
// 类型
// ============================================================

export interface Post {
  id: number;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  author: { id: string; nickname: string; type: string };
  pet?: { id: string; name: string; stage: string; personality: string } | null;
  isLiked: boolean;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: { id: string; nickname: string };
}

export interface Friend {
  id: string;
  nickname: string;
  type: string;
  friendsSince?: string;
  isFriend?: boolean;
}

export interface FriendPet {
  id: string;
  name: string;
  personality: string;
  stage: string;
  level: number;
  stats: { hunger: number; cleanliness: number; mood: number; energy: number; health: number };
}

// ============================================================
// Store
// ============================================================

interface SocialState {
  // 广场
  posts: Post[];
  isLoadingPosts: boolean;
  hasMorePosts: boolean;
  currentPage: number;

  // 当前帖子评论
  comments: Comment[];
  isLoadingComments: boolean;

  // 好友
  friends: Friend[];
  searchResults: Friend[];
  visitFriend: { friend: any; pets: FriendPet[] } | null;

  // 错误状态
  error: string | null;

  // --- Actions ---
  clearError: () => void;
  fetchPosts: (refresh?: boolean) => Promise<void>;
  createPost: (content: string, petId?: string) => Promise<void>;
  toggleLike: (postId: number) => Promise<void>;
  fetchComments: (postId: number) => Promise<void>;
  addComment: (postId: number, content: string) => Promise<void>;

  // 好友
  searchUsers: (keyword: string) => Promise<void>;
  addFriend: (friendId: string) => Promise<void>;
  fetchFriends: () => Promise<void>;
  visitFriendHome: (friendId: string) => Promise<void>;
  clearVisit: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  posts: [],
  isLoadingPosts: false,
  hasMorePosts: true,
  currentPage: 1,

  comments: [],
  isLoadingComments: false,

  friends: [],
  searchResults: [],
  visitFriend: null,
  error: null,

  clearError: () => set({ error: null }),

  // ============================================================
  // 广场动态
  // ============================================================

  fetchPosts: async (refresh = false) => {
    const page = refresh ? 1 : get().currentPage;
    set({ isLoadingPosts: true, error: null });

    try {
      const result = await apiFetch<{
        posts: Post[];
        pagination: { page: number; hasMore: boolean; total: number };
      }>(`/social/posts?page=${page}&pageSize=20`);

      set(state => ({
        posts: refresh ? result.posts : [...state.posts, ...result.posts],
        currentPage: result.pagination.page,
        hasMorePosts: result.pagination.hasMore,
      }));
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoadingPosts: false });
    }
  },

  createPost: async (content: string, petId?: string) => {
    try {
      const result = await apiFetch<{ post: Post; message: string }>('/social/posts', {
        method: 'POST',
        body: JSON.stringify({ content, petId }),
      });

      // 新帖子插入到列表顶部
      set(state => ({
        posts: [result.post, ...state.posts],
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err; // 让 UI 层知道失败了
    }
  },

  toggleLike: async (postId: number) => {
    try {
      const result = await apiFetch<{ isLiked: boolean }>(`/social/posts/${postId}/like`, {
        method: 'POST',
      });

      // 更新帖子点赞状态
      set(state => ({
        posts: state.posts.map(p =>
          p.id === postId
            ? { ...p, isLiked: result.isLiked, likesCount: p.likesCount + (result.isLiked ? 1 : -1) }
            : p
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  // ============================================================
  // 评论
  // ============================================================

  fetchComments: async (postId: number) => {
    set({ isLoadingComments: true, error: null });
    try {
      const result = await apiFetch<{ comments: Comment[] }>(`/social/posts/${postId}/comments`);
      set({ comments: result.comments });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoadingComments: false });
    }
  },

  addComment: async (postId: number, content: string) => {
    try {
      const result = await apiFetch<{ comment: Comment }>(`/social/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });

      set(state => ({
        comments: [...state.comments, result.comment],
        posts: state.posts.map(p =>
          p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
        ),
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  // ============================================================
  // 好友系统
  // ============================================================

  searchUsers: async (keyword: string) => {
    if (keyword.length < 2) {
      set({ searchResults: [] });
      return;
    }
    try {
      const result = await apiFetch<{ users: Friend[] }>(`/social/friends/search?q=${encodeURIComponent(keyword)}`);
      set({ searchResults: result.users });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addFriend: async (friendId: string) => {
    try {
      await apiFetch('/social/friends/add', {
        method: 'POST',
        body: JSON.stringify({ friendId }),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
    // 刷新搜索列表（标记为已添加）
    // 刷新搜索列表（标记为已添加）
    set(state => ({
      searchResults: state.searchResults.map(u =>
        u.id === friendId ? { ...u, isFriend: true } : u
      ),
    }));
  },

  fetchFriends: async () => {
    try {
      const result = await apiFetch<{ friends: Friend[] }>('/social/friends');
      set({ friends: result.friends });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  visitFriendHome: async (friendId: string) => {
    set({ error: null });
    try {
      const result = await apiFetch<{ friend: any; pets: FriendPet[]; canInteract: boolean }>(
        `/social/friends/${friendId}/visit`
      );
      set({ visitFriend: { friend: result.friend, pets: result.pets } });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearVisit: () => set({ visitFriend: null }),
}));
