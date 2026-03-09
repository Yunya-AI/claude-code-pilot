# Claude Code Pilot - 支持 node-pty 原生编译 + SQLite 默认
FROM node:20-bookworm-slim AS base

# node-pty 编译依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    zsh \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依赖
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# 源码
COPY . .

# 生成 Prisma Client（需 DATABASE_URL，默认 SQLite）
ENV DATABASE_URL="file:./data/claude_code_pilot.db"
RUN pnpm db:generate
RUN pnpm build

# 生产镜像
FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    zsh curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3040
ENV SOCKET_PORT=3041

# 复制构建产物
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/package.json ./
COPY --from=base /app/next.config.js ./
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/socket ./socket
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/src ./src
COPY --from=base /app/public ./public

# 启动脚本（同时运行 Next.js + Socket.io）
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3040 3041

ENTRYPOINT ["/docker-entrypoint.sh"]
