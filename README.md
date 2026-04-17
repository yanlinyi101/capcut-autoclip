# CapCut Autoclip

**语言 / Language**: 中文 | [English](README-EN.md)

[![Python](https://img.shields.io/badge/Python-3.13+-green?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-red?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5+-blue?style=flat&logo=antdesign)](https://ant.design)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)

面向剪映（CapCut）创作者的 B-Roll 素材自动化工具。从草稿字幕中提取关键词，由大模型判定哪些段落需要补充画面，再到 YouTube / Bilibili 自动搜索并批量下载匹配素材。

---

## 🚀 macOS 一键启动

```bash
curl -fsSL https://raw.githubusercontent.com/yanlinyi101/capcut-autoclip/main/install.sh | bash
```

脚本会自动：克隆仓库 → 创建 venv → 安装 Python/前端依赖 → 询问是否立即启动 → 浏览器自动打开 `http://localhost:3002`。

> 前置条件：`git` `python3` `node` `npm`（缺失时脚本会提示用 Homebrew 安装）。`ffmpeg` 和 `yt-dlp` 强烈建议安装：`brew install ffmpeg yt-dlp`。

---

## 功能特性

### 字幕处理
- **剪映草稿扫描** — 自动读取本机剪映草稿，展示封面、时长、修改时间
- **三种字幕来源** — 自动检测草稿目录 SRT / 拖拽上传 SRT / 从最近文件中选择 / ASR 自动生成
- **ASR 兜底** — 上传剪映导出的视频，自动通过 bcut-asr（B 站语音识别）或 OpenAI Whisper 生成字幕
- **最近文件智能扫描** — 自动列出 Desktop / Downloads / Movies / Documents 下 30 天内的视频和 SRT 文件

### 关键词与 AI B-Roll 判定
- **jieba 关键词提取** — 词性标注 + 名词类（地名、人名、专有名词等）+ 停用词过滤
- **LLM 智能判定** — DeepSeek（OpenAI 兼容接口）批量分析每行字幕是否需要补 B-Roll，给出理由
- **规则降级** — LLM 不可用时自动切换到规则判定（含强专有名词且时长 ≥ 3s）
- **可编辑表格** — 用户可手动调整关键词、勾选/取消勾选行

### 多平台素材搜索
- **YouTube + Bilibili 双源** — yt-dlp 同时搜索两个平台
- **智能查询构造** — YouTube 自动加入 `航拍 OR 纪录片 OR 4K OR 实拍 OR 影像` 等正向修饰，过滤 `-讲解 -解说 -reaction` 等讲解类
- **去重与缓存** — 多 P 分集去重、相同关键词缓存复用

### 实时进度与下载
- **SSE 全流程实时推送** — ASR / 关键词提取 / 搜索 / 下载，每一步进度实时反映到前端
- **批量下载** — 一键下载选中素材到项目目录的 `autoclip_downloads/`，逐项进度条
- **持久化配置** — 所有设置写入 `settings.json`，重启后保留

---

## 技术栈

### 后端

| 组件 | 技术 |
|---|---|
| Web 框架 | Python 3.13 + FastAPI + uvicorn |
| 实时推送 | SSE（sse-starlette） |
| 配置管理 | pydantic-settings，持久化到 `settings.json` |
| 中文分词 | jieba（词性标注、名词提取） |
| 字幕解析 | pysrt |
| ASR 识别 | bcut-asr / openai-whisper |
| 音频提取 | ffmpeg |
| 大模型 | DeepSeek（openai SDK，OpenAI 兼容接口） |
| 素材搜索 | yt-dlp（YouTube + Bilibili） |
| 异步任务 | asyncio + 内存任务队列 |

### 前端

| 组件 | 技术 |
|---|---|
| UI 框架 | React 18 + TypeScript 5 + Vite 5 |
| 组件库 | Ant Design 5（深色主题） |
| 状态管理 | Zustand 4 |
| 路由 | React Router 6 |
| HTTP 客户端 | axios |
| 实时通信 | EventSource（SSE） |
| 日期处理 | dayjs + relativeTime |

---

## 项目结构

```
.
├── install.sh                        # macOS 一键安装脚本
├── start.sh                          # 启动后端 + 前端 + 自动开浏览器
├── backend/
│   ├── main.py                       # FastAPI 入口
│   ├── core/
│   │   ├── config.py                 # 配置类（持久化到 settings.json）
│   │   └── sse_manager.py            # SSE 事件生成器
│   ├── schemas/                      # Pydantic 请求/响应模型
│   ├── services/
│   │   ├── asr_service.py            # ASR 字幕生成（bcut-asr / Whisper）
│   │   ├── extract_service.py        # SRT 解析 + jieba 关键词提取
│   │   ├── llm_service.py            # DeepSeek B-Roll 智能判定
│   │   ├── broll_detector.py         # 规则降级判定
│   │   ├── init_service.py           # 项目初始化、内存存储
│   │   ├── scan_service.py           # 剪映草稿扫描
│   │   ├── search_service.py         # YouTube / Bilibili 搜索
│   │   └── download_service.py       # yt-dlp 批量下载
│   ├── api/                          # FastAPI 路由
│   └── tasks/background.py           # 异步后台任务队列
├── frontend/
│   └── src/
│       ├── pages/                    # InitPage / ExtractPage / SearchPage / DownloadPage / SettingsPage
│       ├── components/               # Header / StepIndicator / DraftCard / KeywordsTable / …
│       ├── services/api.ts           # axios 客户端
│       ├── store/                    # Zustand store
│       └── hooks/useSSE.ts           # EventSource 封装
└── requirements.txt
```

---

## 手动安装（不使用一键脚本）

### 依赖

- Python 3.13+
- Node.js 18+
- ffmpeg（ASR 功能需要）
- yt-dlp（素材下载需要）

### 步骤

```bash
# 克隆仓库
git clone https://github.com/yanlinyi101/capcut-autoclip.git
cd capcut-autoclip

# 后端
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 前端
cd frontend && npm install && cd ..

# 启动（推荐使用 start.sh）
./start.sh
```

或手动启动：

```bash
# Terminal 1 - 后端
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 - 前端
cd frontend && npm run dev
```

浏览器打开 http://localhost:3002

---

## 使用流程

1. **选择草稿** — 首页自动扫描剪映草稿，点击其中一个进入
2. **提供字幕** — 草稿内有 SRT 则直接读取；否则上传剪映导出的成品视频，等待 ASR 自动生成
3. **AI 关键词分析** — jieba 抽取名词关键词后，DeepSeek 自动判定哪些行需要补 B-Roll
4. **搜索素材** — 选中行自动在 YouTube + Bilibili 搜索，结果以卡片形式实时呈现
5. **批量下载** — 勾选想要的素材，一键下载到 `{草稿目录}/autoclip_downloads/`

---

## 配置说明（设置页面）

| 项目 | 说明 | 默认值 |
|---|---|---|
| 剪映草稿目录 | 自动扫描路径 | `~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft` |
| ASR 方式 | `bcut`（在线，需联网）/ `whisper`（本地） | `bcut` |
| Whisper 模型 | tiny / base / small / medium / large | `base` |
| 识别语言 | zh / en / ja / auto | `zh` |
| ffmpeg 路径 | ffmpeg 可执行文件路径 | `ffmpeg` |
| yt-dlp 路径 | yt-dlp 可执行文件路径 | `yt-dlp` |
| 每平台结果数 | 每个关键词每个平台的搜索结果数 | 3 |
| 下载格式 | yt-dlp 格式字符串 | `bestvideo*+bestaudio/best` |
| LLM 启用 | 是否使用 DeepSeek 判定 B-Roll | 否 |
| DeepSeek API Key | 大模型 API 密钥 | — |
| DeepSeek 模型 | 模型名（如 `deepseek-chat`） | `deepseek-chat` |
| 代理 | yt-dlp 下载代理（可选） | — |

---

## 致谢与引用声明

本项目的部分实现参考并借鉴了 [AutoClip](https://github.com/zhouxiaoka/autoclip)（MIT License，Copyright © 2024 AutoClip Team）的代码与设计：

| 本项目模块 | 参考来源（AutoClip） |
|---|---|
| `backend/services/asr_service.py` | `backend/utils/speech_recognizer.py` — bcut-asr 上传/轮询/SRT 输出流程，Whisper 推断与 SRT 格式化 |
| `backend/services/extract_service.py`（SRT 解析） | `backend/utils/text_processor.py` — pysrt 时间轴解析与文本清洗思路 |
| `frontend/src/index.css` | `frontend/src/index.css` — 深色主题 CSS 变量、Ant Design 组件覆盖样式、毛玻璃效果 |
| `frontend/src/components/Header.tsx` | `frontend/src/components/Header.tsx` — 毛玻璃顶栏布局与渐变 Logo 样式 |
| `frontend/src/App.tsx`（布局结构） | `frontend/src/App.tsx` — Layout + 路由结构模式 |

其余核心功能（剪映草稿扫描、jieba 关键词提取、DeepSeek B-Roll 判定、YouTube + Bilibili 双源搜索、yt-dlp 下载、SSE 实时进度、Zustand 状态管理、macOS 一键安装脚本）为本项目独立实现。

---

## License

MIT
