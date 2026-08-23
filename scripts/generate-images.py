"""
帽子AI宠物 - 图片生成脚本
使用智谱 cogView-4-250304 生成 App 图标和封面图
"""
from zai import ZhipuAiClient
import os

# API Key 从环境变量读取，安全优先
client = ZhipuAiClient(api_key=os.environ.get("ZHIPU_API_KEY", ""))

# ============================================================
# 1. App 图标 - 1024x1024 正方形，需适配 iOS/Android 应用商店
# ============================================================
icon_prompt = (
    "A cute cartoon cat character wearing a colorful knitted beanie hat, "
    "big sparkling eyes, soft pastel colors, chibi style, "
    "minimalist clean background with subtle gradient from light blue to soft pink, "
    "kawaii aesthetic, app icon design, rounded corners, "
    "high quality 3D render with soft lighting, "
    "no text, no watermark, centered composition"
)

# ============================================================
# 2. 封面图 - 手机 APP 应用商店展示图 (1242x2688 竖屏)
# ============================================================
cover_prompt = (
    "Mobile app promotional poster for an AI virtual pet game called 'Hat AI Pet', "
    "featuring an adorable cartoon cat wearing a knitted hat as the main character, "
    "surrounded by floating hearts, stars, and small gift boxes, "
    "warm and healing art style, soft pastel color palette with mint green and peach pink, "
    "dreamy bokeh background, cute UI elements like hearts and stars floating around, "
    "the cat is sitting happily on a fluffy cloud, "
    "app store screenshot style, professional mobile game key art, "
    "no text overlay, ultra high quality illustration"
)

# ============================================================
# 3. 网站/宣传横幅 - 横版 16:9
# ============================================================
banner_prompt = (
    "Wide banner illustration for AI pet mobile app website, "
    "featuring a cute cat with a beanie hat as the mascot, "
    "soft healing art style, dreamy pastel gradient background, "
    "floating UI elements showing pet care icons like food bowl, heart, moon, "
    "sparkles and gentle lighting effects, "
    "kawaii Japanese illustration style, warm and cozy atmosphere, "
    "no text, professional game art"
)

print("🎨 正在生成 App 图标...")
icon_response = client.images.generations(
    model="cogView-4-250304",
    prompt=icon_prompt,
    size="1024x1024",
)
print(f"✅ App 图标: {icon_response.data[0].url}")

print("🎨 正在生成封面图...")
cover_response = client.images.generations(
    model="cogView-4-250304",
    prompt=cover_prompt,
    size="1024x1792",  # 16的倍数，竖屏，总像素 < 2^21
)
print(f"✅ 封面图: {cover_response.data[0].url}")

print("🎨 正在生成宣传横幅...")
banner_response = client.images.generations(
    model="cogView-4-250304",
    prompt=banner_prompt,
    size="1792x1024",  # 16的倍数，横版，总像素 < 2^21
)
print(f"✅ 宣传横幅: {banner_response.data[0].url}")

print("\n🎉 全部图片生成完成！")
print("请将以上 URL 下载保存到 assets/images/ 目录")
