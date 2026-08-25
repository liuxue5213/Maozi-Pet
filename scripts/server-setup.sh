#!/bin/bash
# ============================================================
# 帽子AI宠物 - 服务器初始化脚本
# 在服务器上首次部署前运行一次
# 服务器: 通过 GitHub Secrets / 环境变量配置
# ============================================================

set -e

echo "🐱 帽子AI宠物 - 服务器环境初始化"
echo "================================"

# 1. 更新系统
echo "📦 更新系统..."
apt update && apt upgrade -y

# 2. 安装 Node.js 18
if ! command -v node &> /dev/null; then
    echo "📦 安装 Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo "✅ Node.js $(node -v) 已安装"
else
    echo "✅ Node.js 已存在: $(node -v)"
fi

# 3. 安装 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
    echo "✅ PM2 已安装"
else
    echo "✅ PM2 已存在"
fi

# 4. 安装 Nginx（前端 Web 服务）
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo "✅ Nginx 已安装并启动"
else
    echo "✅ Nginx 已存在"
fi

# 5. 创建项目目录
echo "📁 创建项目目录..."
mkdir -p /opt/maozi-pet/backend
mkdir -p /opt/maozi-pet/frontend
mkdir -p /opt/maozi-pet/backups

# 6. 配置 Nginx（反向代理后端 API）
echo "⚙️ 配置 Nginx..."
cat > /etc/nginx/sites-available/maozi-pet << 'NGINXEOF'
server {
    listen 80;
    server_name _;  # 替换为你的域名

    # 前端静态文件
    root /opt/maozi-pet/frontend;
    index index.html;

    # API 反向代理到后端 60235
    location /api/ {
        proxy_pass http://127.0.0.1:60235;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 前端 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

# 启用站点
ln -sf /etc/nginx/sites-available/maozi-pet /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && nginx -s reload

# 7. 配置防火墙
echo "🔒 配置防火墙..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 60235/tcp
ufw --force enable

# 8. 配置 PM2 开机自启
pm2 startup systemd -u root --hp /root

echo ""
echo "🎉 服务器初始化完成！"
echo ""
echo "下一步："
echo "1. 在 GitHub 仓库配置 Secrets（参考 .github/SECRETS.md）"
echo "2. push 到 main 分支，自动触发部署"
echo "3. 手动测试: curl http://localhost:60235/api/health"
echo ""
echo "常用命令："
echo "  pm2 status              # 查看服务状态"
echo "  pm2 logs maozi-pet-backend  # 查看日志"
echo "  pm2 restart maozi-pet-backend  # 重启服务"
