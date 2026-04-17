#!/usr/bin/env bash
# CapCut Autoclip - start backend + frontend, open browser
set -e

cd "$(dirname "$0")"

C_CYAN='\033[1;36m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RESET='\033[0m'

info()    { echo -e "${C_CYAN}▶${C_RESET} $*"; }
success() { echo -e "${C_GREEN}✓${C_RESET} $*"; }
warn()    { echo -e "${C_YELLOW}!${C_RESET} $*"; }

BACKEND_PORT=8000
FRONTEND_PORT=3002

# ── Free ports if occupied ─────────────────────────────────
free_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        warn "端口 $port 被占用，正在释放 (PID: $pids)..."
        kill -9 $pids 2>/dev/null || true
        sleep 0.5
    fi
}
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

# ── Sanity checks ──────────────────────────────────────────
if [ ! -d venv ]; then
    warn "venv 不存在，请先运行 ./install.sh"
    exit 1
fi
if [ ! -d frontend/node_modules ]; then
    warn "frontend/node_modules 不存在，请先运行 ./install.sh"
    exit 1
fi

# ── Start backend ──────────────────────────────────────────
info "启动后端 (FastAPI on :$BACKEND_PORT)..."
# shellcheck disable=SC1091
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port "$BACKEND_PORT" \
    --log-level warning > /tmp/capcut-autoclip-backend.log 2>&1 &
BACKEND_PID=$!

# ── Start frontend ─────────────────────────────────────────
info "启动前端 (Vite on :$FRONTEND_PORT)..."
(cd frontend && npm run dev > /tmp/capcut-autoclip-frontend.log 2>&1) &
FRONTEND_PID=$!

# ── Cleanup on Ctrl-C ──────────────────────────────────────
cleanup() {
    echo ""
    info "正在停止服务..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    success "已停止"
    exit 0
}
trap cleanup INT TERM

# ── Wait for services ──────────────────────────────────────
info "等待服务启动..."
for _ in {1..30}; do
    if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1; then
        success "后端已就绪"
        break
    fi
    sleep 0.5
done

for _ in {1..30}; do
    if curl -fsS "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1; then
        success "前端已就绪"
        break
    fi
    sleep 0.5
done

# ── Open browser ───────────────────────────────────────────
info "打开浏览器: http://localhost:$FRONTEND_PORT"
open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true

echo ""
echo -e "${C_GREEN}═══════════════════════════════════════════${C_RESET}"
echo -e "${C_GREEN}  CapCut Autoclip 正在运行${C_RESET}"
echo -e "${C_GREEN}═══════════════════════════════════════════${C_RESET}"
echo "  前端: http://localhost:$FRONTEND_PORT"
echo "  后端: http://localhost:$BACKEND_PORT"
echo "  日志: tail -f /tmp/capcut-autoclip-{backend,frontend}.log"
echo ""
echo "  按 Ctrl+C 停止服务"
echo ""

wait
