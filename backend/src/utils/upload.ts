/**
 * 帽子AI宠物 - 社区图片上传纯函数
 * 发帖配图（Pengu/小红书 UGC 方向）。安全边界：
 * · mime 白名单（jpeg/png/webp），扩展名由 mime 映射而非用户输入（防路径注入）
 * · base64 格式与解码后体积校验（JSON body 1mb 上限内）
 * · 帖子 imageUrl 只接受本站 /uploads/ 路径（防任意外链注入/SSRF 式引用）
 */

/** 解码后单图上限（bytes）。base64 膨胀 ~1.33x，800KB 解码 ≈ 1.06MB base64，超 JSON 1mb 限制，
 *  故取 700KB：留出 JSON 转义余量后仍在 1mb 内；前端选图压缩到 1080px/0.6 质量通常 <400KB */
export const MAX_UPLOAD_BYTES = 700 * 1024;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const BASE64_RE = /^[A-Za-z0-9+/=\r\n]+$/;

export function imageExtFromMime(mime: unknown): string | null {
  if (typeof mime !== 'string') return null;
  return MIME_EXT[mime.toLowerCase()] || null;
}

/** 校验 base64 载荷，返回解码后字节数；非法/超限返回 null */
export function validateBase64Image(base64: unknown): number | null {
  if (typeof base64 !== 'string' || base64.length === 0) return null;
  if (!BASE64_RE.test(base64)) return null;
  // base64 长度 → 字节数：去掉 padding 后 4 字符 = 3 字节
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((base64.length - padding) * 3 / 4);
  if (bytes <= 0 || bytes > MAX_UPLOAD_BYTES) return null;
  return bytes;
}

/** 帖子 imageUrl 白名单：只接受本站上传接口返回的路径 */
const POST_IMAGE_URL_RE = /^\/uploads\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/;

export function isValidPostImageUrl(url: unknown): url is string {
  return typeof url === 'string' && POST_IMAGE_URL_RE.test(url);
}

/** 从合法 imageUrl 提取磁盘文件名（调用方拼接上传目录后 best-effort 清理） */
export function filenameFromPostImageUrl(url: string): string | null {
  if (!isValidPostImageUrl(url)) return null;
  return url.replace('/uploads/', '');
}
