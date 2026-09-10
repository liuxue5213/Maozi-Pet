/**
 * 帽子AI宠物 - 社区广场页
 * 浏览动态、发帖、点赞、评论、好友
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSocialStore, Post } from '../../../store/socialStore';
import { usePetStore } from '../../../store/petStore';
import { staticBaseUrl } from '../../../config/env';
import { apiFetch } from '../../../config/env';
import { FRAME_RING_COLORS } from '../../../config/appearance';

// ============================================================
// 子组件
// ============================================================

function PostCard({
  post, isMine, onLike, onComment, onDelete,
}: {
  post: Post; isMine: boolean; onLike: () => void; onComment: () => void; onDelete: () => void;
}) {
  const timeAgo = getTimeAgo(post.createdAt);
  // 作者头像：真实头像 emoji；作者宠物的头像框装备 → 彩色描边
  const frameRing = post.pet?.frameItem ? FRAME_RING_COLORS[post.pet.frameItem] : null;
  // 两段点击确认删除（Alert.alert 在 Web 端为 no-op，用平台无关的交互）
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    setConfirmingDelete(false);
    onDelete();
  };

  return (
    <View style={styles.postCard}>
      {/* 作者信息 */}
      <View style={styles.postHeader}>
        <View style={[styles.avatarCircle, frameRing ? styles.avatarCircleFramed : null, frameRing ? { borderColor: frameRing } : null]}>
          <Text style={styles.avatarEmoji}>{post.author.avatarEmoji || '🐱'}</Text>
        </View>
        <View style={styles.postHeaderInfo}>
          <Text style={styles.authorName}>
            {post.author.nickname}
            {!!post.author.habitStreak && post.author.habitStreak >= 2 && (
              <Text style={styles.authorStreak}> 🔥{post.author.habitStreak}</Text>
            )}
          </Text>
          <Text style={styles.postTime}>{timeAgo}</Text>
        </View>
        {post.pet && (
          <View style={styles.petTag}>
            <Text style={styles.petTagText}>🐾 {post.pet.name} · {stageLabel(post.pet.stage)}</Text>
          </View>
        )}
      </View>

      {/* 内容 */}
      <Text style={styles.postContent}>{post.content}</Text>
      {post.imageUrl ? (
        <Image
          source={{ uri: `${staticBaseUrl}${post.imageUrl}` }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {/* 互动按钮 */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Text style={[styles.actionIcon, post.isLiked && styles.actionIconActive]}>
            {post.isLiked ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.actionCount, post.isLiked && styles.actionCountActive]}>
            {post.likesCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onComment}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{post.commentsCount}</Text>
        </TouchableOpacity>
        {isMine && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Text style={styles.actionIcon}>{confirmingDelete ? '❓' : '🗑️'}</Text>
            <Text style={[styles.actionCount, confirmingDelete && styles.deleteConfirmText]}>
              {confirmingDelete ? '再点一次删除' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CommentModal({
  visible,
  onClose,
  post,
}: {
  visible: boolean;
  onClose: () => void;
  post: Post | null;
}) {
  const { comments, isLoadingComments, fetchComments, addComment } = useSocialStore();
  const [text, setText] = useState('');

  React.useEffect(() => {
    if (visible && post) {
      fetchComments(post.id);
    }
  }, [visible, post]);

  const handleSubmit = async () => {
    if (!text.trim() || !post) return;
    await addComment(post.id, text.trim());
    setText('');
  };

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>评论</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.commentsList}>
          {/* 原帖内容 */}
          <View style={styles.originalPost}>
            <Text style={styles.originalPostAuthor}>{post.author.nickname}</Text>
            <Text style={styles.originalPostContent}>{post.content}</Text>
          </View>

          {isLoadingComments ? (
            <ActivityIndicator color="#FF9F43" style={{ marginTop: 20 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.emptyComments}>还没有评论，来抢沙发~</Text>
          ) : (
            comments.map((c: any) => (
              <View key={c.id} style={styles.commentItem}>
                <Text style={styles.commentAuthor}>{c.author.nickname}</Text>
                <Text style={styles.commentContent}>{c.content}</Text>
                <Text style={styles.commentTime}>{getTimeAgo(c.createdAt)}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* 评论输入框 */}
        <View style={styles.commentInputBar}>
          <TextInput
            style={styles.commentInput}
            value={text}
            onChangeText={setText}
            placeholder="说点什么吧..."
            placeholderTextColor="#BBB"
            maxLength={200}
            multiline
          />
          <TouchableOpacity
            style={[styles.commentSubmit, !text.trim() && styles.commentSubmitDisabled]}
            onPress={handleSubmit}
            disabled={!text.trim()}
          >
            <Text style={styles.commentSubmitText}>发送</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function SocialScreen() {
  const router = useRouter();
  const { user, pet } = usePetStore();
  const {
    posts, isLoadingPosts, hasMorePosts, fetchPosts, createPost, deletePost, toggleLike, error, clearError,
  } = useSocialStore();

  const [showCompose, setShowCompose] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [attachPet, setAttachPet] = useState(false);
  const [attachImage, setAttachImage] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notices, setNotices] = useState<{ id: number; type: string; content: string; is_read: number; created_at: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotices, setShowNotices] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      const r = await apiFetch<{ items: typeof notices; unreadCount: number }>('/notifications');
      setNotices(r.items);
      setUnread(r.unreadCount);
    } catch { /* 静默：红点拉取失败不打扰主流程 */ }
  }, []);

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read', { method: 'POST' });
      setUnread(0);
      setNotices(list => list.map(n => ({ ...n, is_read: 1 })));
    } catch { /* 忽略 */ }
  };

  // 进入页面时加载
  useFocusEffect(
    useCallback(() => {
      fetchPosts(true);
      fetchNotices();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPosts(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoadingPosts && hasMorePosts) {
      fetchPosts();
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const b64 = asset.base64;
    if (!b64) return;
    setAttachImage({ uri: asset.uri, base64: b64, mime: asset.mimeType || 'image/jpeg' });
  };

  const handlePublish = async () => {
    if (!composeText.trim() || publishing) return;
    setPublishing(true);
    try {
      // 先传图拿到本站地址，再发帖（图挂了不阻断发帖，文案仍在）
      let imageUrl: string | undefined;
      if (attachImage) {
        try {
          imageUrl = await apiFetch<{ url: string }>('/social/upload', {
            method: 'POST',
            body: JSON.stringify({ base64: attachImage.base64, mime: attachImage.mime }),
          }).then(r => r.url);
        } catch { imageUrl = undefined; }
      }
      await createPost(composeText.trim(), attachPet && pet ? pet.id : undefined, imageUrl);
      setComposeText('');
      setAttachPet(false);
      setAttachImage(null);
      setShowCompose(false);
    } finally {
      setPublishing(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    try {
      await deletePost(postId);
      // 正在看的评论弹窗对应帖子被删则一并关闭
      if (selectedPost?.id === postId) setShowComments(false);
    } catch {
      // 失败信息已由 store 写入 error banner
    }
  };

  const handleComment = (post: Post) => {
    setSelectedPost(post);
    setShowComments(true);
  };

  return (
    <View style={styles.container}>
      {/* 错误提示 */}
      {error ? (
        <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Text style={styles.errorDismiss}>✕</Text>
        </TouchableOpacity>
      ) : null}

      {/* 顶部 Tab 切换 */}
      <View style={styles.topTabs}>
        <TouchableOpacity style={[styles.topTab, styles.topTabActive]}>
          <Text style={[styles.topTabText, styles.topTabTextActive]}>广场</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topTab} onPress={() => router.push('/social/friends')}>
          <Text style={styles.topTabText}>好友</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topTab} onPress={() => { setShowNotices(true); if (unread > 0) markAllRead(); }}>
          <Text style={styles.topTabText}>🔔{unread > 0 ? unread : '通知'}</Text>
        </TouchableOpacity>
      </View>

      {/* 动态列表 */}
      <ScrollView
        style={styles.feed}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF9F43" />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 100) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={200}
      >
        {posts.length === 0 && !isLoadingPosts ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌍</Text>
            <Text style={styles.emptyText}>广场还没有动态</Text>
            <Text style={styles.emptySubtext}>成为第一个发帖的人吧！</Text>
          </View>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              isMine={!!user && post.author.id === user.id}
              onLike={() => toggleLike(post.id)}
              onComment={() => handleComment(post)}
              onDelete={() => handleDeletePost(post.id)}
            />
          ))
        )}

        {isLoadingPosts && <ActivityIndicator color="#FF9F43" style={{ marginVertical: 20 }} />}
        {!hasMorePosts && posts.length > 0 && (
          <Text style={styles.noMoreText}>— 已经到底了 —</Text>
        )}
      </ScrollView>

      {/* 发帖 FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCompose(true)}>
        <Text style={styles.fabIcon}>✏️</Text>
      </TouchableOpacity>

      {/* 发帖弹窗 */}
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCompose(false)}>
              <Text style={styles.modalCancel}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>发布动态</Text>
            <TouchableOpacity onPress={handlePublish} disabled={!composeText.trim() || publishing}>
              <Text style={[styles.modalPublish, (!composeText.trim() || publishing) && styles.modalPublishDisabled]}>
                {publishing ? '发布中…' : '发布'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.composeBody}>
            <View style={styles.composeAvatar}>
              <Text style={styles.composeAvatarText}>{user?.avatarEmoji || '🐱'}</Text>
            </View>
            <TextInput
              style={styles.composeInput}
              value={composeText}
              onChangeText={setComposeText}
              placeholder="分享你和宠物的日常..."
              placeholderTextColor="#BBB"
              multiline
              autoFocus
              maxLength={500}
            />
          </View>

          {attachImage && (
            <View style={styles.imagePreviewRow}>
              <View style={styles.imagePreview}>
                <Image source={{ uri: attachImage.uri }} style={styles.imagePreviewImg} />
                <TouchableOpacity style={styles.imagePreviewRemove} onPress={() => setAttachImage(null)}>
                  <Text style={styles.imagePreviewRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.composeFooter}>
            <TouchableOpacity style={styles.imageAttachBtn} onPress={pickImage}>
              <Text style={styles.imageAttachText}>🖼️ 配图</Text>
            </TouchableOpacity>
            {pet && (
              <TouchableOpacity
                style={[styles.petAttachChip, attachPet && styles.petAttachChipActive]}
                onPress={() => setAttachPet(!attachPet)}
              >
                <Text style={[styles.petAttachText, attachPet && styles.petAttachTextActive]}>
                  {attachPet ? '✓' : '+'} 🐾 和 {pet.name} 一起
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.composeCount}>{composeText.length}/500</Text>
          </View>
        </View>
      </Modal>

      {/* 评论弹窗 */}
      <CommentModal visible={showComments} onClose={() => setShowComments(false)} post={selectedPost} />

      {/* 通知中心 */}
      <Modal visible={showNotices} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔔 通知</Text>
              <TouchableOpacity onPress={() => setShowNotices(false)}>
                <Text style={styles.modalClose}>关闭</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {notices.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#BBB', padding: 30, fontSize: 13 }}>
                  还没有通知~ 去和大家互动吧
                </Text>
              )}
              {notices.map(n => (
                <View key={n.id} style={[styles.noticeRow, !n.is_read && styles.noticeRowUnread]}>
                  <Text style={styles.noticeIcon}>{n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : '🏠'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noticeContent}>{n.content}</Text>
                    <Text style={styles.noticeTime}>{getTimeAgo(n.created_at)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// 工具函数
// ============================================================

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function stageLabel(stage: string): string {
  if (stage === 'egg') return '宠物蛋';
  if (stage === 'child') return '幼体';
  if (stage === 'teen') return '少年';
  return '成年';
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 14 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
  noticeRowUnread: { backgroundColor: '#FFF6E8' },
  noticeIcon: { fontSize: 20 },
  noticeContent: { fontSize: 13, color: '#5A4A4A' },
  noticeTime: { fontSize: 11, color: '#BBB', marginTop: 2 },
  imageAttachBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  imageAttachText: { fontSize: 13, color: '#8A7A6A', fontWeight: '600' },
  imagePreviewRow: { paddingHorizontal: 16, marginTop: 10 },
  imagePreview: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden' },
  imagePreviewImg: { width: '100%', height: '100%' },
  imagePreviewRemove: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20,
    borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  imagePreviewRemoveText: { color: '#FFF', fontSize: 12 },
  postImage: {
    width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: '#F5EFE6',
  },
  container: { flex: 1, backgroundColor: '#FFF5F7' },
  topTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  topTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  topTabActive: { backgroundColor: '#FFF0E0' },
  topTabText: { fontSize: 14, color: '#999', fontWeight: '500' },
  topTabTextActive: { color: '#FF9F43', fontWeight: '600' },
  feed: { flex: 1 },
  postCard: {
    backgroundColor: '#FFF',
    marginTop: 8,
    marginHorizontal: 12,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircleFramed: { borderWidth: 3 },
  avatarEmoji: { fontSize: 18 },
  postHeaderInfo: { flex: 1, marginLeft: 10 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#5A4A4A' },
  authorStreak: { fontSize: 12, color: '#D2691E', fontWeight: '700' },
  postTime: { fontSize: 11, color: '#BBB', marginTop: 1 },
  petTag: { backgroundColor: '#F0F8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  petTagText: { fontSize: 11, color: '#54A0FF' },
  postContent: { fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 12 },
  postActions: { flexDirection: 'row', gap: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F8F8F8' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 18 },
  actionIconActive: { transform: [{ scale: 1.1 }] },
  actionCount: { fontSize: 13, color: '#999' },
  actionCountActive: { color: '#FF6B6B', fontWeight: '600' },
  deleteConfirmText: { color: '#FF6B6B', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF9F43',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#FF9F43', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  fabIcon: { fontSize: 24 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#777', fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: '#BBB', marginTop: 4 },
  noMoreText: { textAlign: 'center', color: '#CCC', fontSize: 12, marginVertical: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3F0',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#C0392B' },
  errorDismiss: { fontSize: 14, color: '#999', paddingLeft: 8 },

  // 弹窗
  modalContainer: { flex: 1, backgroundColor: '#FFF5F7' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#5A4A4A' },
  modalClose: { fontSize: 18, color: '#999' },
  modalCancel: { fontSize: 14, color: '#999' },
  modalPublish: { fontSize: 14, fontWeight: '600', color: '#FF9F43' },
  modalPublishDisabled: { opacity: 0.4 },

  // 发帖
  composeBody: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', flex: 1 },
  composeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  composeAvatarText: { fontSize: 20 },
  composeInput: { flex: 1, fontSize: 15, color: '#444', lineHeight: 24, textAlignVertical: 'top' },
  composeFooter: { padding: 12, backgroundColor: '#FFF', alignItems: 'flex-end' },
  petAttachChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 8,
  },
  petAttachChipActive: { backgroundColor: '#E8F8F5' },
  petAttachText: { fontSize: 13, color: '#54A0FF', fontWeight: '500' },
  petAttachTextActive: { color: '#5A7A6A' },
  composeCount: { fontSize: 12, color: '#BBB' },

  // 评论
  commentsList: { flex: 1, padding: 16 },
  originalPost: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginBottom: 16 },
  originalPostAuthor: { fontSize: 13, fontWeight: '600', color: '#5A4A4A', marginBottom: 4 },
  originalPostContent: { fontSize: 14, color: '#666' },
  emptyComments: { textAlign: 'center', color: '#CCC', fontSize: 13, marginTop: 40 },
  commentItem: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#5A4A4A', marginBottom: 4 },
  commentContent: { fontSize: 14, color: '#444', lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#CCC', marginTop: 4 },
  commentInputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    maxHeight: 80,
    backgroundColor: '#F8F8F8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#444',
  },
  commentSubmit: {
    marginLeft: 8,
    backgroundColor: '#FF9F43',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  commentSubmitDisabled: { opacity: 0.4 },
  commentSubmitText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
});
