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
  needs_broll?: boolean
  broll_reason?: string
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
  bilibili_results: MaterialItem[]
}

export type Platform = 'youtube' | 'bilibili'

export interface MaterialsResponse {
  materials: SearchGroupResult[]
  total_youtube: number
  total_bilibili: number
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
  deepseek_api_key: string
  deepseek_base_url: string
  deepseek_model: string
  llm_enabled: boolean
  proxy_url: string
}

export interface AsrProgress {
  stage: string
  message: string
  method?: string
  srt_path?: string
  error?: string
}

// ------- Edit pipeline -------

export interface Transform {
  x: number
  y: number
  scale: number
}

export interface BrollSegment {
  segment_id: string
  row_index: number | null
  start: number
  end: number
  duration: number
  text: string
  keywords: string[]
  all_keywords: string[]
  reason: string
  confidence: number
}

export interface FrameMeta {
  material_id: number | null
  scene_idx: number
  timestamp: number
  scene_start: number
  scene_end: number
  frame_path: string
}

export interface PresetInfo {
  id: string
  label: string
  transform: Transform
}

export interface PlanItem {
  segment_id: string
  start: number
  end: number
  material_id: number
  source_offset: number
  preset: string
  transform: Transform
}

export interface OutputClip {
  segment_id: string
  clip_path: string
  clip_rel: string
  duration: number
  preset: string
  transform: Transform
  timeline_start: number
  timeline_end: number
  source_material_id: number | null
}

export interface KeyframeIndex {
  [materialId: string]: FrameMeta[]
}
