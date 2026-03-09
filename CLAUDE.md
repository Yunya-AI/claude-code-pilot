# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Claude Code 任务管理平台 - 通过 Web 界面管理和触发 Claude Code 任务，支持实时终端输出和交互输入。

## 常用命令

```bash
# 安装依赖
pnpm install

# 同时启动 Next.js 和 Socket.io 服务（开发模式）
pnpm dev

# 单独启动服务
pnpm dev:next    # Next.js on port 3040
pnpm dev:socket  # Socket.io on port 3041

# 数据库操作
pnpm db:generate  # 生成 Prisma Client
pnpm db:push      # 推送 schema 到数据库（开发环境）
pnpm db:migrate   # 创建迁移文件
pnpm db:studio    # 打开 Prisma Studio

# 构建和运行
pnpm build
pnpm start        # 生产环境启动

# 代码检查
pnpm lint
```

## 环境变量

`.env` 文件必需配置：

```env
# 默认 SQLite（零配置）
DATABASE_URL="file:./data/claude_code_pilot.db"
# 或 MySQL
# DATABASE_URL="mysql://user:pass@localhost:3306/db_name"
JWT_SECRET="your-secret-key"
AUTH_PASSWORD="admin123"
PORT=3040
SOCKET_PORT=3041
```

## 架构概览

### 双服务架构

项目运行两个独立的进程：

1. **Next.js 服务器** (端口 3040)
   - App Router + React 组件
   - API Routes (`src/app/api/`)
   - 静态资源和页面渲染

2. **Socket.io 服务器** (端口 3041, `socket/server.ts`)
   - WebSocket 实时通信
   - Claude Code 进程管理 (`claudeRunner`)
   - 内部 HTTP API (`/internal/tasks/*`) 用于 Next.js 与 Socket 服务通信

### 数据流程

```
浏览器 → Next.js API → Socket.io 内部 API → ClaudeRunner → Claude Code 进程
                ↑                    ↓
                └────── WebSocket ←──┘ (实时输出)
```

### 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| **ClaudeRunner** | `src/lib/claude-runner.ts` | 使用 node-pty 管理 Claude Code 进程，处理输出流、输入、终端调整 |
| **Socket Server** | `socket/server.ts` | WebSocket 服务 + 内部 API（启动/停止/查询任务） |
| **Socket Client** | `src/lib/socket-client.ts` | Next.js 调用 Socket 内部 API 的封装 |
| **Auth** | `src/lib/auth.ts` | JWT 认证，`withAuth` 中间件保护 API |
| **Terminal** | `src/components/terminal/` | xterm.js 组件，处理终端显示和用户输入 |

### 数据库模型 (Prisma)

支持 SQLite（默认）和 MySQL，根据 `DATABASE_URL` 自动选择：
- `file:` 开头 → `prisma/schema.sqlite.prisma`
- `mysql:` 开头 → `prisma/schema.mysql.prisma`

- **Project**: 项目管理（id, name, path, description）
- **Task**: 任务记录（id, projectId, prompt, status, output, textOutput）
- **Template**: 提示词模板（id, name, prompt）

TaskStatus: `PENDING | RUNNING | COMPLETED | FAILED | STOPPED | DELETED`

## 重要技术点

### node-pty 配置

`next.config.js` 中配置：
```js
experimental: {
  serverComponentsExternalPackages: ['node-pty'],
}
```

### 启动 Claude Code 进程

`claude-runner.ts` 中的执行命令：
```bash
claude --allowedTools 'Bash(*)' 'Read(*)' 'Edit(*)' 'Write(*)' 'Glob(*)' 'Grep(*)' 'MultiEdit(*)' -- '<prompt>'
```

使用 `/bin/zsh -l -c` 启动，确保 PATH 环境变量包含 `/root/.local/bin` 等。

### WebSocket 房间模式

客户端加入 `task-{taskId}` 房间接收任务输出：
- `join-task`: 加入房间
- `output`: 实时输出
- `finished`: 任务完成
- `input`: 发送输入到终端
- `resize`: 调整终端大小

### 输出保存策略

ClaudeRunner 使用 2 秒防抖定时器保存输出到数据库 (`output` 原始 + `textOutput` 去除 ANSI 码)，进程退出时立即保存最终状态。

## 前端规范

- **UI 组件**: shadcn/ui 位于 `src/components/ui/`
- **样式**: Tailwind CSS，使用 HSL 变量系统
- **类型定义**: `src/types/index.ts` 包含 Project, Task, Template, ApiResponse, PaginatedResponse
- **Socket 集成**: 使用 `startTaskViaSocket` / `stopTaskViaSocket` 触发任务，前端通过 socket.io-client 接收实时输出

## API Routes

所有受保护的路由使用 `withAuth` 中间件：
- `POST /api/auth/login` - 登录获取 token
- `GET/POST /api/projects` - 项目管理
- `GET/POST /api/templates` - 模板管理
- `GET/POST/DELETE /api/tasks` - 任务 CRUD
- `POST /api/tasks/:id/start` - 启动任务（调用 socket 内部 API）
- `POST /api/tasks/:id/stop` - 停止任务
