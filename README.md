# Claude Code Pilot

A web-based task management platform for [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) — manage and trigger Claude Code tasks via a web UI with real-time terminal output.

[中文文档](docs/README.zh-CN.md)

## Features

- Web-triggered Claude Code tasks (background execution)
- Web terminal with xterm.js (real-time streaming output + interactive input)
- Project management, task history, and prompt templates
- Simple password authentication
- SQLite / MySQL support (SQLite by default, zero-config)

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Terminal**: xterm.js + node-pty
- **Realtime**: Socket.io (WebSocket)
- **Database**: SQLite (default) / MySQL + Prisma ORM
- **Auth**: Password + JWT

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and adjust:

```env
# Database (SQLite by default, no extra service needed)
# SQLite: file:./data/claude_code_pilot.db
# MySQL: mysql://root:password@localhost:3306/claude_code_pilot
DATABASE_URL="file:./data/claude_code_pilot.db"

# JWT secret
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Admin password
AUTH_PASSWORD="admin123"

# Ports
PORT=3040
SOCKET_PORT=3041
```

### 3. Initialize database

```bash
pnpm db:push
```

SQLite will auto-create the `data/` directory and database file.

### 4. Start dev server

```bash
pnpm dev
```

- Web UI: http://localhost:3040
- Socket.io: http://localhost:3041

### 5. Login

Use the configured `AUTH_PASSWORD` (default: `admin123`).

## Docker

```bash
docker compose up -d
```

Access at http://localhost:3040. Override env via `.env` or `docker compose` `environment`. Data persists in `app-data` volume.

## Production

```bash
pnpm build
# Option 1: Single command
pnpm start:all

# Option 2: PM2
pm2 start ecosystem.config.cjs
```

## Usage

### Projects

1. Go to **Projects**
2. Create a project with name and local path

### Templates

1. Go to **Templates**
2. Create reusable prompt templates

### Run tasks

1. Go to **Tasks**
2. Create a task, select project and prompt
3. Start the task and view real-time output in the terminal

## Project structure

```
claude-code-pilot/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   ├── (auth)/               # Auth pages
│   │   └── (dashboard)/         # Main app
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui
│   │   ├── terminal/             # xterm.js terminal
│   │   └── layout/               # Layout components
│   ├── lib/                      # Utilities
│   │   ├── db.ts                 # Prisma client
│   │   ├── auth.ts               # Auth helpers
│   │   └── claude-runner.ts      # Claude Code process manager
│   └── types/                    # TypeScript types
├── prisma/
│   ├── schema.sqlite.prisma      # SQLite schema (default)
│   └── schema.mysql.prisma       # MySQL schema
├── socket/
│   └── server.ts                 # WebSocket server
└── package.json
```

## Prerequisites

### Claude Code CLI

Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) and ensure it's in your PATH:

**macOS / Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://claude.ai/install.ps1 | iex
```

Verify: `claude --version`

First run opens the browser for OAuth (Claude Pro/Max subscription required).

### Other

- Project paths must be valid and accessible on the server
- node-pty requires build tools (python3, make, g++) — Docker image includes them
- Windows: set `SHELL_PATH` for PowerShell if needed; defaults to cmd.exe

## License

MIT
