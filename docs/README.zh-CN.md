# Claude Code Pilot

Claude Code 任务管理平台 - 通过 Web 界面管理和触发 Claude Code 任务。

## 功能特性

- Web 触发 Claude Code 任务（后台启动）
- Web 终端显示（xterm.js 实时流式输出 + 交互输入）
- 项目管理、历史记录、任务模板
- 简单密码认证
- SQLite / MySQL 数据存储（默认 SQLite，零配置）

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **终端**: xterm.js + node-pty
- **实时通信**: Socket.io (WebSocket)
- **数据库**: SQLite（默认）/ MySQL + Prisma ORM
- **认证**: 简单密码 + JWT

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```env
# 数据库配置（默认 SQLite，无需额外服务）
# SQLite: file:./data/claude_code_pilot.db
# MySQL: mysql://root:password@localhost:3306/claude_code_pilot
DATABASE_URL="file:./data/claude_code_pilot.db"

# JWT 密钥
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# 管理员密码
AUTH_PASSWORD="admin123"

# 服务端口
PORT=3000
SOCKET_PORT=3001
```

### 3. 初始化数据库

执行（SQLite 会自动创建 data 目录和数据库文件）：

```bash
pnpm db:push
```

### 4. 启动服务

```bash
# 同时启动 Next.js 和 Socket.io 服务
pnpm dev
```

服务启动后：
- Web 界面: http://localhost:3000
- Socket.io 服务: http://localhost:3001

### 5. 登录

使用配置的 `AUTH_PASSWORD` 密码登录（默认为 `admin123`）。

## Docker 部署

```bash
# 构建并启动（默认 SQLite）
docker compose up -d

# 访问 http://localhost:3040
```

环境变量可通过 `.env` 或 `docker compose` 的 `environment` 覆盖。数据持久化在 `app-data` volume。

## 生产环境启动

```bash
pnpm build
# 方式一：单命令启动（concurrently）
pnpm start:all

# 方式二：PM2 守护进程
pm2 start ecosystem.config.cjs
```

## 使用说明

### 项目管理

1. 进入「项目管理」页面
2. 点击「新建项目」
3. 填写项目名称和路径（必须是有效的本地项目路径）

### 任务模板

1. 进入「任务模板」页面
2. 创建常用的提示词模板，方便复用

### 运行任务

1. 进入「任务记录」页面
2. 点击「新建任务」
3. 选择项目和提示词
4. 点击「启动任务」
5. 在任务详情页面查看实时终端输出

## 项目结构

```
claude_code_pilot/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   ├── (auth)/               # 认证相关页面
│   │   └── (dashboard)/          # 主应用页面
│   ├── components/               # React 组件
│   │   ├── ui/                   # shadcn/ui 组件
│   │   ├── terminal/             # 终端组件
│   │   └── layout/               # 布局组件
│   ├── lib/                      # 工具库
│   │   ├── db.ts                 # Prisma 客户端
│   │   ├── auth.ts               # 认证工具
│   │   └── claude-runner.ts      # Claude Code 进程管理
│   ├── hooks/                    # 自定义 Hooks
│   └── types/                    # TypeScript 类型
├── prisma/
│   ├── schema.sqlite.prisma      # SQLite schema（默认）
│   └── schema.mysql.prisma       # MySQL schema
├── socket/
│   └── server.ts                 # WebSocket 服务
└── package.json
```

## 注意事项

### Claude Code CLI 安装

运行任务前需安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) 并在 PATH 中可用：

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://claude.ai/install.ps1 | iex
```

**验证:** `claude --version`

首次运行会打开浏览器进行 OAuth 认证（需 Claude Pro/Max 订阅）。

### 其他

1. 项目路径必须是服务器可以访问的有效路径
2. node-pty 需要编译，确保系统有 python3、make、g++（Docker 镜像已包含）
3. Windows 用户可设置 `SHELL_PATH` 指定 shell（如 PowerShell 路径），默认使用 cmd.exe
