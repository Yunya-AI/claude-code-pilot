#!/bin/zsh

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo "${RED}[ERROR]${NC} $1"
}

set -e
trap 'print_error "部署失败！"; exit 1' ERR

# 项目配置
PROJECT_NAME="claude-code-pilot"
LOG_DIR="logs"
PID_DIR="pids"

# 端口配置
NEXT_PORT=3040
SOCKET_PORT=3041

# PID 文件路径
NEXT_PID_FILE="${PROJECT_ROOT}/${PID_DIR}/next.pid"
SOCKET_PID_FILE="${PROJECT_ROOT}/${PID_DIR}/socket.pid"

# 按端口杀掉所有占用进程
kill_by_port() {
    local port="$1"
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        for p in $pids; do
            kill -9 $p 2>/dev/null || true
        done
        return 0
    fi
    return 1
}

# 根据 PID 文件停止进程（杀整个进程树 + 端口兜底）
stop_by_pidfile() {
    local pid_file="$1"
    local name="$2"
    local port="$3"

    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if [[ -n "$pid" ]] && ps -p $pid > /dev/null 2>&1; then
            print_info "停止 ${name} (PID: $pid) 及其子进程..."
            # 杀整个进程组
            kill -15 -- -$pid 2>/dev/null || kill -15 $pid 2>/dev/null || true
            sleep 2
            # 仍存活则强制杀
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 -- -$pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
                sleep 1
            fi
        fi
        rm -f "$pid_file"
    fi

    # 兜底：按端口清理残留进程（npx 派生的子进程可能脱离进程组）
    if [[ -n "$port" ]]; then
        local remaining=$(lsof -ti :$port 2>/dev/null || true)
        if [[ -n "$remaining" ]]; then
            print_warning "${name}: 端口 $port 仍被占用 (PID: $remaining)，强制清理..."
            kill_by_port $port
            sleep 1
        fi
    fi

    print_success "${name} 已停止"
}

# 部署模式
INTERACTIVE_MODE=false
WEB_ONLY=false
SOCKET_ONLY=false

for arg in "$@"; do
    case $arg in
        -i|--interactive) INTERACTIVE_MODE=true ;;
        --web) WEB_ONLY=true ;;
        --socket) SOCKET_ONLY=true ;;
    esac
done

if [[ "$INTERACTIVE_MODE" == true ]]; then
    print_info "交互模式已启用"
fi
if [[ "$WEB_ONLY" == true ]]; then
    print_info "仅部署网页前端（不重启 Socket.io / Claude 执行器）"
fi
if [[ "$SOCKET_ONLY" == true ]]; then
    print_info "仅重启 Socket.io 服务（不重新构建网页）"
fi


mkdir -p ${LOG_DIR} ${PID_DIR}

echo ""
echo "${BLUE}================================${NC}"
echo "${BLUE}   Claude Code Pilot 部署脚本${NC}"
if [[ "$WEB_ONLY" == true ]]; then
    echo "${YELLOW}   (仅网页前端)${NC}"
elif [[ "$SOCKET_ONLY" == true ]]; then
    echo "${YELLOW}   (仅 Socket.io)${NC}"
elif [[ "$INTERACTIVE_MODE" == true ]]; then
    echo "${YELLOW}   (交互模式)${NC}"
else
    echo "${GREEN}   (全量部署)${NC}"
fi
echo "${BLUE}================================${NC}"
echo ""

# ========== 1. 检查 Git 状态 ==========

print_info "检查 Git 状态..."
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
print_info "当前分支: ${CURRENT_BRANCH}"

if [[ -n $(git status -s 2>/dev/null) ]]; then
    print_warning "检测到未提交的更改"
    if [[ "$INTERACTIVE_MODE" == true ]]; then
        read "response?是否继续部署? (y/n) "
        if [[ ! $response =~ ^[Yy]$ ]]; then
            print_error "部署已取消"
            exit 1
        fi
    else
        print_warning "自动模式下跳过未提交更改检查"
    fi
else
    print_info "工作区干净，继续部署"
fi

# ========== 2. 拉取最新代码 ==========

print_info "拉取最新代码..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    git pull origin ${CURRENT_BRANCH} 2>/dev/null || git pull
    print_success "代码更新完成"
else
    print_warning "不是 Git 仓库，跳过 git pull"
fi

# ========== 3. 安装依赖 ==========

print_info "安装项目依赖..."

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm 未安装，请先安装 pnpm"
    exit 1
fi

pnpm install
print_success "依赖安装完成"

# 批准原生模块构建（node-pty 等需要编译）
if pnpm approve-builds --help &>/dev/null; then
    print_info "检查原生模块构建..."
    pnpm approve-builds 2>/dev/null || true
fi

# ========== 4. 生成 Prisma Client ==========

print_info "生成 Prisma Client..."
pnpm db:generate
print_success "Prisma Client 生成完成"

# ========== 5. 数据库迁移 ==========

print_info "执行数据库迁移..."
pnpm db:push
print_success "数据库迁移完成"

# ========== 6. 构建 Next.js ==========

if [[ "$SOCKET_ONLY" == true ]]; then
    print_info "跳过 Next.js 构建（--socket 模式）"
else
    print_info "构建 Next.js 项目..."
    pnpm build

    if [[ ! -d ".next" ]]; then
        print_error "构建失败：.next 目录不存在"
        exit 1
    fi
    print_success "Next.js 构建完成"
fi

# ========== 7. 停止现有进程 ==========

print_info "停止现有进程..."

# 加载环境变量（停止/启动前都需要）
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
fi

SERVICES_OK=true

if [[ "$SOCKET_ONLY" == true ]]; then
    # 仅重启 Socket.io
    stop_by_pidfile "$SOCKET_PID_FILE" "Socket.io" "$SOCKET_PORT"
    print_info "保留 Next.js 服务不动"
elif [[ "$WEB_ONLY" == true ]]; then
    # 仅重启 Next.js
    stop_by_pidfile "$NEXT_PID_FILE" "Next.js" "$NEXT_PORT"
    print_info "保留 Socket.io 服务不动（正在运行的 Claude 任务不受影响）"
else
    # 全量部署：停掉所有
    stop_by_pidfile "$NEXT_PID_FILE" "Next.js" "$NEXT_PORT"
    stop_by_pidfile "$SOCKET_PID_FILE" "Socket.io" "$SOCKET_PORT"
fi

# ========== 8. 启动服务 ==========

print_info "启动服务..."

# 启动 Next.js
if [[ "$SOCKET_ONLY" != true ]]; then
    print_info "启动 Next.js 服务 (端口: ${NEXT_PORT})..."
    setsid nohup npx next start -p ${NEXT_PORT} > ${PROJECT_ROOT}/${LOG_DIR}/next.log 2>&1 &
    NEXT_NEW_PID=$!
    echo $NEXT_NEW_PID > "$NEXT_PID_FILE"
    print_success "Next.js 已启动 (PID: $NEXT_NEW_PID)"
else
    print_info "跳过 Next.js 启动（--socket 模式）"
fi

# 启动 Socket.io
if [[ "$WEB_ONLY" != true ]]; then
    print_info "启动 Socket.io 服务 (端口: ${SOCKET_PORT})..."
    setsid nohup npx tsx socket/server.ts > ${PROJECT_ROOT}/${LOG_DIR}/socket.log 2>&1 &
    SOCKET_NEW_PID=$!
    echo $SOCKET_NEW_PID > "$SOCKET_PID_FILE"
    print_success "Socket.io 已启动 (PID: $SOCKET_NEW_PID)"
else
    print_info "跳过 Socket.io 启动（--web 模式，Claude 执行器保持运行）"
fi

sleep 3

# 验证服务

if [[ "$SOCKET_ONLY" != true ]]; then
    if [[ -n "$NEXT_NEW_PID" ]] && ps -p $NEXT_NEW_PID > /dev/null 2>&1; then
        print_success "Next.js 服务运行正常"
    elif [[ -n "$NEXT_NEW_PID" ]]; then
        print_error "Next.js 服务启动失败，请检查日志: ${LOG_DIR}/next.log"
        rm -f "$NEXT_PID_FILE"
        SERVICES_OK=false
    fi
fi

if [[ "$WEB_ONLY" != true ]]; then
    if [[ -n "$SOCKET_NEW_PID" ]] && ps -p $SOCKET_NEW_PID > /dev/null 2>&1; then
        print_success "Socket.io 服务运行正常"
    elif [[ -n "$SOCKET_NEW_PID" ]]; then
        print_error "Socket.io 服务启动失败，请检查日志: ${LOG_DIR}/socket.log"
        rm -f "$SOCKET_PID_FILE"
        SERVICES_OK=false
    fi
fi

# WEB_ONLY 模式下检查 Socket.io 是否仍在运行
if [[ "$WEB_ONLY" == true ]]; then
    if [[ -f "$SOCKET_PID_FILE" ]]; then
        local_socket_pid=$(cat "$SOCKET_PID_FILE")
        if ps -p $local_socket_pid > /dev/null 2>&1; then
            print_success "Socket.io / Claude 执行器仍在运行 (PID: $local_socket_pid)"
        else
            print_warning "Socket.io 未在运行，如需启动请执行: ./deploy.sh --socket"
        fi
    fi
fi

# ========== 9. 更新 Nginx 配置 ==========

print_info "更新 Nginx 配置..."

NGINX_CONF_SRC="${PROJECT_ROOT}/server-config/claudecode.nginx.conf"
NGINX_CONF_DST="/ai/opt/nginx/conf/sites/${PROJECT_NAME}.conf"

if [[ -f "$NGINX_CONF_SRC" ]]; then
    sudo mkdir -p "$(dirname "$NGINX_CONF_DST")"
    sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
    print_success "Nginx 配置已复制到 $NGINX_CONF_DST"

    NGINX_BIN=$(command -v nginx 2>/dev/null || echo "/ai/opt/nginx/sbin/nginx")
    print_info "测试 Nginx 配置..."
    if $NGINX_BIN -t 2>/dev/null; then
        print_success "Nginx 配置测试通过"
        print_info "重新加载 Nginx..."
        $NGINX_BIN -s reload
        print_success "Nginx 已重新加载"
    else
        print_warning "Nginx 配置测试失败，跳过 Nginx 重启"
    fi
else
    print_warning "未找到 Nginx 配置文件 $NGINX_CONF_SRC，跳过 Nginx 更新"
fi

# ========== 10. 完成 ==========

echo ""
echo "${GREEN}================================${NC}"
echo "${GREEN}   部署完成！${NC}"
echo "${GREEN}================================${NC}"
echo ""
print_info "构建时间: $(date '+%Y-%m-%d %H:%M:%S')"

if [[ -n "$CURRENT_BRANCH" ]] && [[ "$CURRENT_BRANCH" != "unknown" ]]; then
    print_info "Git 分支: ${CURRENT_BRANCH}"
    print_info "Git 提交: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
fi

echo ""

if [[ "$SERVICES_OK" == true ]]; then
    print_success "域名访问: 请根据 Nginx 配置的 server_name 访问"
    print_success "Next.js 服务: http://localhost:${NEXT_PORT}"
    print_success "Socket.io 服务: ws://localhost:${SOCKET_PORT}"
else
    print_warning "部分服务启动异常，请检查日志"
fi

print_info "Next.js PID 文件: ${NEXT_PID_FILE}"
print_info "Socket.io PID 文件: ${SOCKET_PID_FILE}"
print_info "Next.js 日志: ${PROJECT_ROOT}/${LOG_DIR}/next.log"
print_info "Socket.io 日志: ${PROJECT_ROOT}/${LOG_DIR}/socket.log"
echo ""

echo ""
print_info "用法说明:"
print_info "  ./deploy.sh              全量部署（重启所有服务）"
print_info "  ./deploy.sh --web        仅更新网页（不影响正在运行的 Claude 任务）"
print_info "  ./deploy.sh --socket     仅重启 Socket.io / Claude 执行器"
print_info "  ./deploy.sh -i           交互模式"
echo ""
