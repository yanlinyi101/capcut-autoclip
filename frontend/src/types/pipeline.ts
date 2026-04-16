export interface ProjectResponse {
  project_id: string
  project_path: string
  srt_path: string
  video_path: string
  has_draft_content: boolean
  has_srt: boolean
  has_video: boolean
  status: string
  current_step: number
  created_at: string
}

export interface KeywordRow {
  index: number
  start_time: string
  end_time: string
  text: string
  keywords: string[]
}

export interface ExtractResponse {
  project_id: string
  total_rows: number
  keywords: KeywordRow[]
}

export interface MaterialItem {
  id: number | null
  title: string
  url: string
  duration: string | null
  platform: string
}

export interface SearchGroupResult {
  keyword: string
  row_index: number
  start_time: string
  original_text: string
  youtube_results: MaterialItem[]
  douyin_results: MaterialItem[]
}

export interface MaterialsResponse {
  materials: SearchGroupResult[]
  total_youtube: number
  total_douyin: number
}

export interface SearchProgress {
  row_index: number
  total_rows: number
  keyword: string
  platform: string
  status: string
}

export interface DownloadProgress {
  material_id: number
  title: string
  status: string
  percent: number
  file_path?: string
  file_size?: string
  error?: string
}

export interface DownloadComplete {
  completed: number
  failed: number
  total: number
}

export interface DraftInfo {
  draft_id: string
  draft_name: string
  draft_path: string
  cover_path: string
  has_cover: boolean
  has_srt: boolean
  srt_has_content: boolean
  has_video: boolean
  duration_seconds: number
  materials_size: number
  created_at: string | null
  modified_at: string | null
  is_ai_shorts: boolean
}

export interface AppSettings {
  jianying_draft_path: string
  yt_dlp_path: string
  max_search_rows: number
  results_per_platform: number
  download_format: string
  asr_method: string
  whisper_model: string
  language: string
  ffmpeg_path: string
}

export interface AsrProgress {
  stage: string
  message: string
  method?: string
  srt_path?: string
  error?: string
}
