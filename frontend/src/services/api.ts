import axios from 'axios'
import type {
  ProjectResponse,
  ExtractResponse,
  MaterialsResponse,
  DraftInfo,
  AppSettings,
  BrollSegment,
  KeyframeIndex,
  PresetInfo,
  PlanItem,
  OutputClip,
} from '../types/pipeline'

export interface ToolStatus {
  installed: boolean
  path: string | null
  version: string | null
  error: string | null
}

export interface DependencyCheck {
  ok: boolean
  critical_missing: string[]
  tools: { [k: string]: ToolStatus }
  python_packages: { [k: string]: { installed: boolean; error: string | null } }
  llm: { enabled: boolean; deepseek_configured: boolean; model: string }
}

export async function checkDependencies(): Promise<DependencyCheck> {
  const { data } = await axios.get('/api/v1/health/dependencies', { timeout: 15000 })
  return data
}

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
})

// Projects
export async function initProject(projectPath: string): Promise<ProjectResponse> {
  const { data } = await api.post('/projects/init', { project_path: projectPath })
  return data
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  const { data } = await api.get(`/projects/${projectId}`)
  return data
}

// Extract
export async function extractKeywords(projectId: string): Promise<ExtractResponse> {
  const { data } = await api.post(`/projects/${projectId}/extract`)
  return data
}

export async function startExtract(
  projectId: string
): Promise<{ task_id: string; status: string; message: string }> {
  const { data } = await api.post(`/projects/${projectId}/extract/start`)
  return data
}

export function getExtractStreamUrl(projectId: string, taskId: string): string {
  return `/api/v1/projects/${projectId}/extract/stream?task_id=${taskId}`
}

export async function getKeywords(projectId: string): Promise<ExtractResponse> {
  const { data } = await api.get(`/projects/${projectId}/keywords`)
  return data
}

// Keyword row edits
export async function patchKeywordRow(
  projectId: string,
  rowIndex: number,
  body: { keywords?: string[]; selected?: boolean }
): Promise<{ row_index: number; keywords: string[]; selected_row_indices: number[] }> {
  const { data } = await api.patch(`/projects/${projectId}/keywords/${rowIndex}`, body)
  return data
}

export async function bulkSelectRows(
  projectId: string,
  mode: 'all' | 'none' | 'ai_recommended'
): Promise<{ selected_row_indices: number[]; count: number }> {
  const { data } = await api.post(`/projects/${projectId}/keywords/bulk-select`, { mode })
  return data
}

// Search
export async function startSearch(
  projectId: string,
  resultsPerPlatform: number = 3,
  platforms: Array<'youtube' | 'bilibili'> = ['youtube', 'bilibili']
): Promise<{ task_id: string; status: string; message: string }> {
  const { data } = await api.post(`/projects/${projectId}/search`, {
    results_per_platform: resultsPerPlatform,
    platforms,
  })
  return data
}

export async function getMaterials(projectId: string): Promise<MaterialsResponse> {
  const { data } = await api.get(`/projects/${projectId}/materials`)
  return data
}

// Download
export async function startDownload(
  projectId: string,
  materialIds: number[]
): Promise<{ task_id: string; total_items: number; status: string }> {
  const { data } = await api.post(`/projects/${projectId}/download`, {
    material_ids: materialIds,
  })
  return data
}

export async function getDownloads(
  projectId: string
): Promise<{ downloads: Record<string, unknown> }> {
  const { data } = await api.get(`/projects/${projectId}/downloads`)
  return data
}

// Drafts
export async function listDrafts(): Promise<{
  drafts: DraftInfo[]
  scan_path: string
  error?: string
}> {
  const { data } = await api.get('/drafts/')
  return data
}

export function getCoverUrl(coverPath: string): string {
  return `/api/v1/drafts/cover?path=${encodeURIComponent(coverPath)}`
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const { data } = await api.get('/settings/')
  return data
}

export async function updateSettings(s: AppSettings): Promise<AppSettings> {
  const { data } = await api.put('/settings/', s)
  return data
}

// ASR
export async function generateSrt(
  projectId: string,
  videoPath?: string
): Promise<{ task_id: string; status: string; message: string }> {
  const { data } = await api.post(`/projects/${projectId}/generate-srt`, {
    video_path: videoPath || '',
  })
  return data
}

// Exported video (剪映成品) upload + recent-exports scan
export async function uploadExportedVideo(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ video_path: string; size_bytes: number; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/projects/${projectId}/upload-exported-video`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

export interface RecentExportItem {
  path: string
  name: string
  size_bytes: number
  mtime: number
  source_dir: string
}

export async function getRecentExports(
  projectId: string
): Promise<{ items: RecentExportItem[] }> {
  const { data } = await api.get(`/projects/${projectId}/recent-exports`)
  return data
}

// SRT import
export async function uploadSrt(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ srt_path: string; size_bytes: number; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/projects/${projectId}/upload-srt`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function useSrtPath(
  projectId: string,
  srtPath: string
): Promise<{ srt_path: string }> {
  const { data } = await api.post(`/projects/${projectId}/use-srt-path`, null, {
    params: { srt_path: srtPath },
  })
  return data
}

export async function getRecentSrt(
  projectId: string
): Promise<{ items: RecentExportItem[] }> {
  const { data } = await api.get(`/projects/${projectId}/recent-srt`)
  return data
}

// SSE URL builders
export function getSearchStreamUrl(projectId: string): string {
  return `/api/v1/projects/${projectId}/search/stream`
}

export function getDownloadStreamUrl(projectId: string): string {
  return `/api/v1/projects/${projectId}/download/stream`
}

export function getSrtStreamUrl(projectId: string, taskId: string): string {
  return `/api/v1/projects/${projectId}/generate-srt/stream?task_id=${taskId}`
}

// Edit pipeline
export async function listPresets(): Promise<{ presets: PresetInfo[] }> {
  const { data } = await api.get('/projects/edit/presets')
  return data
}

export async function detectBroll(
  projectId: string
): Promise<{ project_id: string; total: number; segments: BrollSegment[] }> {
  const { data } = await api.post(`/projects/${projectId}/edit/detect`)
  return data
}

export async function getSegments(
  projectId: string
): Promise<{ project_id: string; total: number; segments: BrollSegment[] }> {
  const { data } = await api.get(`/projects/${projectId}/edit/segments`)
  return data
}

export async function startKeyframes(
  projectId: string
): Promise<{ task_id: string; total_items: number; status: string }> {
  const { data } = await api.post(`/projects/${projectId}/edit/keyframes`)
  return data
}

export function getKeyframeStreamUrl(projectId: string): string {
  return `/api/v1/projects/${projectId}/edit/keyframes/stream`
}

export async function getKeyframes(
  projectId: string
): Promise<{ project_id: string; total_videos: number; index: KeyframeIndex }> {
  const { data } = await api.get(`/projects/${projectId}/edit/keyframes`)
  return data
}

export function getFrameUrl(projectId: string, framePath: string): string {
  return `/api/v1/projects/${projectId}/edit/frame?path=${encodeURIComponent(framePath)}`
}

export function getClipUrl(projectId: string, clipPath: string): string {
  return `/api/v1/projects/${projectId}/edit/clip?path=${encodeURIComponent(clipPath)}`
}

export async function startRender(
  projectId: string,
  plan: PlanItem[],
  canvasWidth: number,
  canvasHeight: number
): Promise<{ task_id: string; total_items: number; status: string }> {
  const { data } = await api.post(`/projects/${projectId}/edit/render`, {
    plan,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
  })
  return data
}

export function getRenderStreamUrl(projectId: string): string {
  return `/api/v1/projects/${projectId}/edit/render/stream`
}

export async function getOutput(
  projectId: string
): Promise<{
  project_id: string
  output_dir: string
  plan_path: string | null
  readme_path: string | null
  clips: OutputClip[]
}> {
  const { data } = await api.get(`/projects/${projectId}/edit/output`)
  return data
}
