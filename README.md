# CapCut Autoclip

**语言 / Language**: 中文 | [English](README-EN.md)

[![Python](https://img.shields.io/badge/Python-3.13+-green?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-red?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5+-blue?style=flat&logo=antdesign)](https://ant.design)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)

一个面向剪映用户的 B-Roll 素材自动搜索与下载工具。从剪映草稿的字幕中提取关键词，自动在 YouTube 和抖音上搜索匹配的 B-Roll 素材，并批量下载。

---

## 功能特性

- **剪映草稿扫描** — 自动读取本机剪映草稿列表，展示封面、时长、修改时间
- **SRT 字幕支持** — 直接解析标准 SRT 字幕文件提取时间轴文本
- **ASR 字幕生成** — 无字幕时通过语音识别自动生成（bcut-asr / OpenAI Whisper）
- **关键词提取** — 基于 jieba 分词，提取名词类关键词（地名、人名、专有名词等）
- **多平台素材搜索** — 同时搜索 YouTube（yt-dlp）和抖音（DuckDuckGo）
- **SSE 实时进度** — 搜索和下载过程实时推送进度，无需刷新页面
- **批量下载** — 勾选 YouTube 视频后一键批量下载，支持自定义格式
- **持久化配置** — 扫描路径、ASR 方式、yt-dlp 参数等配置本地持久保存

---

## 技术栈

### 后端

| 组件 | 技术 |
|---|---|
| Web 框架 | Python 3.13 + FastAPI + uvicorn |
| 实时推送 | SSE（sse-starlette） |
| 配置管理 | pydantic-settings，持久化到 `settings.json` |
| 中文分词 | jieba（词性标注，名词提取） |
| 字幕解析 | pysrt |
| ASR 识别 | bcut-asr（B 站语音识别 API）/ openai-whisper（本地） |
| 音频提取 | ffmpeg |
| 素材搜索 | yt-dlp（YouTube）、duckduckgo-search（抖音） |
| 异步任务 | asyncio + 内存任务队列 |

### 前端

| 组件 | 技术 |
|---|---|
| UI 框架 | React 18 + TypeScript 5 + Vite 5 |
| 组件库 | Ant Design 5 |
| 状态管理 | Zustand 4 |
| 路由 | React Router 6 |
| HTTP 客户端 | axios |
| 实时通信 | EventSource（SSE） |
| 日期处理 | dayjs + relativeTime |

---

## 项目结构

```
.
├── backend/
│   ├── main.py                   # FastAPI 入口，CORS，路由挂载
│   ├── core/
│   │   ├── config.py             # pydantic-settings 配置类（持久化）
│   │   └── sse_manager.py        # SSE 事件生成器
│   ├── schemas/                  # Pydantic 请求/响应模型
│   ├── services/
│   │   ├── asr_service.py        # ASR 字幕生成（bcut-asr / Whisper）
│   │   ├── extract_service.py    # SRT 解析 + jieba 关键词提取
│   │   ├── init_service.py       # 项目初始化，内存存储
│   │   ├── scan_service.py       # 剪映草稿扫描
│   │   ├── search_service.py     # YouTube / 抖音素材搜索
│   │   └── download_service.py   # yt-dlp 批量下载
│   ├── api/                      # FastAPI 路由
│   └── tasks/
│       └── background.py         # 异步后台任务队列
├── frontend/
│   └── src/
│       ├── pages/                # InitPage / ExtractPage / SearchPage / DownloadPage / SettingsPage
│       ├── components/           # Header / StepIndicator / DraftCard / KeywordsTable / …
│       ├── services/api.ts       # axios 客户端
│       ├── store/                # Zustand store
│       └── hooks/useSSE.ts       # EventSource 封装
└── requirements.txt
```

---

## 快速启动

### 依赖

- Python 3.13+
- Node.js 18+
- ffmpeg（ASR 功能需要）
- yt-dlp（素材下载需要）

### 安装

```bash
# 后端
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 启动

```bash
# 后端（项目根目录）
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# 前端（frontend 目录）
npm run dev
```

浏览器打开 http://localhost:3002

---

## 使用流程

1. **选择草稿** — 首页自动扫描本机剪映草稿，点击选择一个
2. **生成/加载字幕** — 若草稿已有 `.srt` 文件则直接解析；否则通过 ASR 从视频生成
3. **提取关键词** — jieba 自动从字幕文本提取名词关键词，按时间轴展示
4. **搜索素材** — 自动按关键词搜索 YouTube 和抖音视频，SSE 实时显示结果
5. **下载素材** — 勾选 YouTube 视频，一键批量下载，实时显示进度

---

## 配置说明

在「设置」页面可配置：

| 项目 | 说明 | 默认值 |
|---|---|---|
| 剪映草稿目录 | 自动扫描路径 | `~/Movies/JianyingPro/…` |
| yt-dlp 路径 | yt-dlp 可执行文件路径 | `yt-dlp` |
| 每次处理行数 | 搜索时处理的关键词行数上限 | 10 |
| 每平台结果数 | 每个关键词每个平台的搜索结果数 | 3 |
| 下载格式 | yt-dlp 格式字符串 | `bestvideo+bestaudio/best` |
| ASR 方式 | `bcut`（在线）或 `whisper`（本地） | `bcut` |
| Whisper 模型 | tiny / base / small / medium / large | `base` |
| 识别语言 | zh / en / ja / auto | `zh` |
| ffmpeg 路径 | ffmpeg 可执行文件路径 | `ffmpeg` |

---

## 致谢与引用声明

本项目的以下部分参考并借鉴了 [AutoClip](https://github.com/zhouxiaoka/autoclip)（MIT License，Copyright © 2024 AutoClip Team）的实现：

| 本项目模块 | 参考来源 |
|---|---|
| `backend/services/asr_service.py` | `autoclip/backend/utils/speech_recognizer.py` — bcut-asr 上传/轮询/SRT 输出流程、Whisper 推断与 SRT 格式化 |
| `backend/services/extract_service.py`（SRT 解析部分） | `autoclip/backend/utils/text_processor.py` — pysrt 解析时间轴与文本清洗思路 |
| `frontend/src/index.css` | `autoclip/frontend/src/index.css` — 深色主题 CSS 变量、Ant Design 组件覆盖样式、毛玻璃效果 |
| `frontend/src/components/Header.tsx` | `autoclip/frontend/src/components/Header.tsx` — 毛玻璃顶栏布局与渐变 Logo 样式 |
| `frontend/src/App.tsx`（布局结构） | `autoclip/frontend/src/App.tsx` — Layout + 路由结构模式 |

其余核心功能（剪映草稿扫描、jieba 关键词提取、yt-dlp 搜索与下载、SSE 实时进度、Zustand 状态管理）为本项目独立实现。

---

## License

MIT
