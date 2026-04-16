# CapCut Autoclip

**Language**: [中文](README.md) | English

[![Python](https://img.shields.io/badge/Python-3.13+-green?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-blue?style=flat&logo=react)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-red?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5+-blue?style=flat&logo=antdesign)](https://ant.design)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](LICENSE)

An automated B-Roll footage search and download tool for CapCut (JianYing) users. It extracts keywords from your project's subtitles, searches for matching B-Roll clips on YouTube and Douyin, and downloads them in bulk.

---

## Features

- **CapCut Draft Scanning** — Automatically reads local CapCut draft projects and displays cover images, duration, and modification time
- **SRT Subtitle Support** — Parses standard SRT subtitle files directly to extract timed text
- **ASR Subtitle Generation** — Generates subtitles via speech recognition when no SRT is present (bcut-asr / OpenAI Whisper)
- **Keyword Extraction** — Uses jieba Chinese word segmentation to extract noun keywords (place names, proper nouns, etc.)
- **Multi-platform Search** — Simultaneously searches YouTube (via yt-dlp) and Douyin (via DuckDuckGo)
- **SSE Real-time Progress** — Live progress updates during search and download via Server-Sent Events
- **Batch Download** — Select YouTube clips and download in bulk with customizable format options
- **Persistent Settings** — Scan path, ASR method, yt-dlp parameters, and more are saved locally

---

## Tech Stack

### Backend

| Component | Technology |
|---|---|
| Web Framework | Python 3.13 + FastAPI + uvicorn |
| Real-time Push | SSE (sse-starlette) |
| Config Management | pydantic-settings, persisted to `settings.json` |
| Chinese NLP | jieba (POS tagging, noun extraction) |
| Subtitle Parsing | pysrt |
| ASR | bcut-asr (Bilibili Speech API) / openai-whisper (local) |
| Audio Extraction | ffmpeg |
| Footage Search | yt-dlp (YouTube), duckduckgo-search (Douyin) |
| Async Tasks | asyncio + in-memory task queue |

### Frontend

| Component | Technology |
|---|---|
| UI Framework | React 18 + TypeScript 5 + Vite 5 |
| Component Library | Ant Design 5 |
| State Management | Zustand 4 |
| Routing | React Router 6 |
| HTTP Client | axios |
| Real-time | EventSource (SSE) |
| Date Handling | dayjs + relativeTime |

---

## Project Structure

```
.
├── backend/
│   ├── main.py                   # FastAPI entry point, CORS, router mounting
│   ├── core/
│   │   ├── config.py             # pydantic-settings config (with persistence)
│   │   └── sse_manager.py        # SSE event generator
│   ├── schemas/                  # Pydantic request/response models
│   ├── services/
│   │   ├── asr_service.py        # ASR subtitle generation (bcut-asr / Whisper)
│   │   ├── extract_service.py    # SRT parsing + jieba keyword extraction
│   │   ├── init_service.py       # Project initialization, in-memory storage
│   │   ├── scan_service.py       # CapCut draft scanning
│   │   ├── search_service.py     # YouTube / Douyin footage search
│   │   └── download_service.py   # yt-dlp batch download
│   ├── api/                      # FastAPI route handlers
│   └── tasks/
│       └── background.py         # Async background task queue
├── frontend/
│   └── src/
│       ├── pages/                # InitPage / ExtractPage / SearchPage / DownloadPage / SettingsPage
│       ├── components/           # Header / StepIndicator / DraftCard / KeywordsTable / …
│       ├── services/api.ts       # axios client
│       ├── store/                # Zustand store
│       └── hooks/useSSE.ts       # EventSource wrapper hook
└── requirements.txt
```

---

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+
- ffmpeg (required for ASR)
- yt-dlp (required for footage download)

### Installation

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Running

```bash
# Backend (from project root)
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Frontend (from frontend/ directory)
npm run dev
```

Open http://localhost:3002 in your browser.

---

## Workflow

1. **Select Draft** — The home page auto-scans local CapCut drafts; click one to select it
2. **Load / Generate Subtitles** — If a `.srt` file exists in the draft folder it is parsed directly; otherwise ASR generates one from the video
3. **Extract Keywords** — jieba extracts noun keywords from subtitle text and displays them on a timeline
4. **Search Footage** — Automatically searches YouTube and Douyin per keyword; results appear in real time via SSE
5. **Download** — Check the YouTube clips you want and download in bulk; progress is shown live

---

## Configuration

All settings are managed in the **Settings** page:

| Setting | Description | Default |
|---|---|---|
| CapCut Draft Directory | Auto-scan path | `~/Movies/JianyingPro/…` |
| yt-dlp Path | Path to the yt-dlp binary | `yt-dlp` |
| Max Rows per Search | Max subtitle rows processed per search run | 10 |
| Results per Platform | Search results per keyword per platform | 3 |
| Download Format | yt-dlp format string | `bestvideo+bestaudio/best` |
| ASR Method | `bcut` (online) or `whisper` (local) | `bcut` |
| Whisper Model | tiny / base / small / medium / large | `base` |
| Recognition Language | zh / en / ja / auto | `zh` |
| ffmpeg Path | Path to the ffmpeg binary | `ffmpeg` |

---

## Acknowledgements & Attribution

The following parts of this project reference and adapt code from [AutoClip](https://github.com/zhouxiaoka/autoclip) (MIT License, Copyright © 2024 AutoClip Team):

| This Project | Source in AutoClip |
|---|---|
| `backend/services/asr_service.py` | `backend/utils/speech_recognizer.py` — bcut-asr upload/poll/SRT output flow; Whisper inference and SRT formatting |
| `backend/services/extract_service.py` (SRT parsing) | `backend/utils/text_processor.py` — pysrt timeline parsing and text cleaning approach |
| `frontend/src/index.css` | `frontend/src/index.css` — dark theme CSS variables, Ant Design component overrides, glassmorphism styles |
| `frontend/src/components/Header.tsx` | `frontend/src/components/Header.tsx` — glassmorphism header layout and gradient logo style |
| `frontend/src/App.tsx` (layout structure) | `frontend/src/App.tsx` — Layout + routing structure pattern |

All other core functionality — CapCut draft scanning, jieba keyword extraction, yt-dlp search and download, SSE real-time progress, and Zustand state management — is original work in this project.

---

## License

MIT
