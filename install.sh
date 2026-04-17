#!/usr/bin/env bash
# CapCut Autoclip - macOS one-liner installer
# Usage: curl -fsSL https://raw.githubusercontent.com/yanlinyi101/capcut-autoclip/main/install.sh | bash

set -e

REPO_URL="https://github.com/yanlinyi101/capcut-autoclip.git"
INSTALL_DIR="${CAPCUT_AUTOCLIP_DIR:-$HOME/capcut-autoclip}"

C_CYAN='\033[1;36m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[1;31m'
C_RESET='\033[0m'

info()    { echo -e "${C_CYAN}▶${C_RESET} $*"; }
success() { echo -e "${C_GREEN}✓${C_RESET} $*"; }
warn()    { echo -e "${C_YELLOW}!${C_RESET} $*"; }
error()   { echo -e "${C_RED}✗${C_RESET} $*"; }

echo ""
echo -e "${C_CYAN}╔══════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_CYAN}║      CapCut Autoclip · macOS 一键安装        ║${C_RESET}"
echo -e "${C_CYAN}╚══════════════════════════════════════════════╝${C_RESET}"
echo ""

# ── OS check ───────────────────────────────────────────────
if [[ "$(uname)" != "Darwin" ]]; then
    error "此脚本仅支持 macOS。请手动参考 README 在其他系统上安装。"
    exit 1
fi

# ── Required tools ─────────────────────────────────────────
info "检查必需工具..."
MISSING=()
command -v git       >/dev/null 2>&1 || MISSING+=("git")
command -v python3   >/dev/null 2>&1 || MISSING+=("python3")
command -v node      >/dev/null 2>&1 || MISSING+=("node")
command -v npm       >/dev/null 2>&1 || MISSING+=("npm")

if [ ${#MISSING[@]} -gt 0 ]; then
    error "缺少必需工具: ${MISSING[*]}"
    warn "请先安装 Homebrew (https://brew.sh)，然后执行："
    echo "    brew install ${MISSING[*]}"
    exit 1
fi
success "必需工具齐备"

# ── Optional tools (warn only) ─────────────────────────────
if ! command -v ffmpeg >/dev/null 2>&1; then
    warn "未检测到 ffmpeg (ASR 字幕生成需要)。建议安装: brew install ffmpeg"
fi
if ! command -v yt-dlp >/dev/null 2>&1; then
    warn "未检测到 yt-dlp (素材下载需要)。建议安装: brew install yt-dlp"
fi

# ── Clone or pull ──────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
    info "更新已有仓库: $INSTALL_DIR"
    cd "$INSTALL_DIR"
    git pull --ff-only || warn "git pull 失败，继续使用当前版本"
else
    info "克隆仓库到: $INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
success "仓库就绪"

# ── Python venv + deps ─────────────────────────────────────
info "创建 Python 虚拟环境..."
if [ ! -d venv ]; then
    python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install --quiet --upgrade pip
info "安装 Python 依赖 (首次较慢)..."
pip install --quiet -r requirements.txt
success "后端依赖安装完成"

# ── Frontend deps ──────────────────────────────────────────
info "安装前端依赖 (首次较慢)..."
(cd frontend && npm install --silent)
success "前端依赖安装完成"

# ── Ensure start.sh executable ─────────────────────────────
chmod +x start.sh 2>/dev/null || true

echo ""
echo -e "${C_GREEN}╔══════════════════════════════════════════════╗${C_RESET}"
echo -e "${C_GREEN}║              ✅ 安装完成！                    ║${C_RESET}"
echo -e "${C_GREEN}╚══════════════════════════════════════════════╝${C_RESET}"
echo ""
echo -e "${C_CYAN}启动服务:${C_RESET}"
echo "    cd $INSTALL_DIR && ./start.sh"
echo ""
echo -e "${C_CYAN}或直接运行:${C_RESET}"
echo "    $INSTALL_DIR/start.sh"
echo ""
echo -e "${C_CYAN}启动后打开浏览器:${C_RESET} http://localhost:3002"
echo ""

# ── Auto-launch if tty available ───────────────────────────
if [ -t 0 ] && [ -t 1 ]; then
    read -r -p "是否立即启动? [Y/n] " REPLY
    REPLY="${REPLY:-Y}"
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        exec "$INSTALL_DIR/start.sh"
    fi
fi
