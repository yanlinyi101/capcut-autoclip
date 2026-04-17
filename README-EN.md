# CapCut Autoclip

**Language**: [中文](README.md) | English

[![Python](https://img.shields.io/badge/Python-3.13+-green?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-red?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5+-blue?style=flat&logo=antdesign)](https://ant.design)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)

An automated B-Roll footage assistant for CapCut (JianYing) creators. Extracts keywords from project subtitles, asks an LLM to decide which lines need supplementary footage, then searches YouTube + Bilibili and downloads matching clips in bulk.

---

## 🚀 macOS one-line install

```bash
curl -fsSL https://raw.githubusercontent.com/yanlinyi101/capcut-autoclip/main/install.sh | bash
```

The script will: clone the repo → set up a Python venv → install Python and frontend deps → ask whether to start immediately → open `http://localhost:3002` in your browser.

> Prerequisites: `git` `python3` `node` `npm` (the script tells you which to `brew install` if missing). `ffmpeg` and `yt-dlp` are strongly recommended: `brew install ffmpeg yt-dlp`.

---

## Features

### Subtitle handling
- **CapCut draft scanning** — auto-reads local CapCut drafts and shows cover, duration, modified time
- **Three subtitle sources** — auto-detect SRT in draft folder / drag-and-drop SRT upload / pick from recent files / ASR generation
- **ASR fallback** — upload an exported video and generate subtitles via bcut-asr (Bilibili Speech) or OpenAI Whisper
- **Recent-file scan** — automatically lists videos and SRTs from Desktop / Downloads / Movies / Documents within the past 30 days

### Keyword extraction & AI B-Roll judgment
- **jieba keywords** — POS tagging + noun classes (place, person, proper nouns) + stop-word filtering
- **LLM judgment** — DeepSeek (OpenAI-compatible) batch-analyzes each subtitle line and decides whether B-Roll is needed, with a reason
- **Rule-based fallback** — if the LLM is unavailable, falls back to rules (strong proper noun present and duration ≥ 3s)
- **Editable table** — manually adjust keywords, check/uncheck rows

### Multi-platform footage search
- **YouTube + Bilibili** — yt-dlp queries both platforms simultaneously
- **Smart query construction** — YouTube queries auto-add positive modifiers (`航拍 OR 纪录片 OR 4K OR 实拍 OR 影像`) and filter out commentary (`-讲解 -解说 -reaction`)
- **Dedup & cache** — multi-part series deduplication; identical keyword queries are cached

### Real-time progress & download
- **End-to-end SSE** — ASR / extraction / search / download progress streamed live to the frontend
- **Batch download** — one-click download of all selected clips into `{draft}/autoclip_downloads/`, with per-item progress bars
- **Persistent settings** — all settings written to `settings.json` and survive restarts

---

## Tech Stack

### Backend

| Component | Technology |
|---|---|
| Web Framework | Python 3.13 + FastAPI + uvicorn |
| Real-time Push | SSE (sse-starlette) |
| Config | pydantic-settings, persisted to `settings.json` |
| Chinese NLP | jieba (POS tagging, noun extraction) |
| Subtitle Parsing | pysrt |
| ASR | bcut-asr / openai-whisper |
| Audio Extraction | ffmpeg |
| LLM | DeepSeek (openai SDK, OpenAI-compatible API) |
| Footage Search | yt-dlp (YouTube + Bilibili) |
| Async Tasks | asyncio + in-memory task queue |

### Frontend

| Component | Technology |
|---|---|
| UI Framework | React 18 + TypeScript 5 + Vite 5 |
| Component Library | Ant Design 5 (dark theme) |
| State Management | Zustand 4 |
| Routing | React Router 6 |
| HTTP Client | axios |
| Real-time | EventSource (SSE) |
| Date Handling | dayjs + relativeTime |

---

## Project Structure

```
.
├── install.sh                        # macOS one-line installer
├── start.sh                          # Starts backend + frontend, opens browser
├── backend/
│   ├── main.py                       # FastAPI entry
│   ├── core/
│   │   ├── config.py                 # Settings (persisted to settings.json)
│   │   └── sse_manager.py            # SSE event generator
│   ├── schemas/                      # Pydantic request/response models
│   ├── services/
│   │   ├── asr_service.py            # ASR (bcut-asr / Whisper)
│   │   ├── extract_service.py        # SRT parsing + jieba keywords
│   │   ├── llm_service.py            # DeepSeek B-Roll judgment
│   │   ├── broll_detector.py         # Rule-based fallback
│   │   ├── init_service.py           # Project init, in-memory storage
│   │   ├── scan_service.py           # CapCut draft scanning
│   │   ├── search_service.py         # YouTube + Bilibili search
│   │   └── download_service.py       # yt-dlp batch download
│   ├── api/                          # FastAPI route handlers
│   └── tasks/background.py           # Async background task queue
├── frontend/
│   └── src/
│       ├── pages/                    # InitPage / ExtractPage / SearchPage / DownloadPage / SettingsPage
│       ├── components/               # Header / StepIndicator / DraftCard / KeywordsTable / …
│       ├── services/api.ts           # axios client
│       ├── store/                    # Zustand store
│       └── hooks/useSSE.ts           # EventSource wrapper hook
└── requirements.txt
```

---

## Manual installation (skip the one-liner)

### Prerequisites

- Python 3.13+
- Node.js 18+
- ffmpeg (required for ASR)
- yt-dlp (required for downloads)

### Steps

```bash
# Clone
git clone https://github.com/yanlinyi101/capcut-autoclip.git
cd capcut-autoclip

# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Run (recommended — uses start.sh)
./start.sh
```

Or run manually:

```bash
# Terminal 1 - backend
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 - frontend
cd frontend && npm run dev
```

Open http://localhost:3002 in your browser.

---

## Workflow

1. **Pick a draft** — the home page auto-scans CapCut drafts; click one to enter
2. **Provide subtitles** — if the draft already has an SRT it is loaded directly; otherwise upload your exported video and let ASR generate one
3. **AI keyword analysis** — jieba pulls noun keywords, then DeepSeek decides which rows need B-Roll
4. **Search footage** — selected rows are queried on YouTube + Bilibili, results stream into the UI in real time
5. **Batch download** — pick the clips you want and download to `{draft}/autoclip_downloads/`

---

## Configuration (Settings page)

| Setting | Description | Default |
|---|---|---|
| CapCut draft directory | Auto-scan path | `~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft` |
| ASR method | `bcut` (online) / `whisper` (local) | `bcut` |
| Whisper model | tiny / base / small / medium / large | `base` |
| Recognition language | zh / en / ja / auto | `zh` |
| ffmpeg path | Path to the ffmpeg binary | `ffmpeg` |
| yt-dlp path | Path to the yt-dlp binary | `yt-dlp` |
| Results per platform | Search results per keyword per platform | 3 |
| Download format | yt-dlp format string | `bestvideo*+bestaudio/best` |
| LLM enabled | Whether to use DeepSeek for B-Roll judgment | off |
| DeepSeek API key | LLM API key | — |
| DeepSeek model | Model name (e.g. `deepseek-chat`) | `deepseek-chat` |
| Proxy | Proxy URL passed to yt-dlp (optional) | — |

---

## Acknowledgements & Attribution

The following parts of this project reference and adapt code and design from [AutoClip](https://github.com/zhouxiaoka/autoclip) (MIT License, Copyright © 2024 AutoClip Team):

| This Project | Source in AutoClip |
|---|---|
| `backend/services/asr_service.py` | `backend/utils/speech_recognizer.py` — bcut-asr upload/poll/SRT output flow; Whisper inference and SRT formatting |
| `backend/services/extract_service.py` (SRT parsing) | `backend/utils/text_processor.py` — pysrt timeline parsing and text-cleaning approach |
| `frontend/src/index.css` | `frontend/src/index.css` — dark-theme CSS variables, Ant Design overrides, glassmorphism |
| `frontend/src/components/Header.tsx` | `frontend/src/components/Header.tsx` — glassmorphism header layout and gradient logo |
| `frontend/src/App.tsx` (layout structure) | `frontend/src/App.tsx` — Layout + routing pattern |

All other core functionality — CapCut draft scanning, jieba keyword extraction, DeepSeek B-Roll judgment, YouTube + Bilibili dual-source search, yt-dlp download, SSE real-time progress, Zustand state management, and the macOS one-liner installer — is original work in this project.

---

## License

MIT
