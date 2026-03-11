#!/bin/sh
set -e

# 初始化 SQLite 数据库（若使用 file:）
if [ -n "$DATABASE_URL" ] && echo "$DATABASE_URL" | grep -q "^file:"; then
  node scripts/db-push.js 2>/dev/null || true
fi

# 启动 Next.js 和 Socket.io（双进程）
pnpm next start -p ${PORT:-3040} &
pnpm tsx socket/server.ts &
wait
