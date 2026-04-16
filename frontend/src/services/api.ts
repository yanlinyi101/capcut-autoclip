import axios from 'axios'
import type {
  ProjectResponse,
  ExtractResponse,
  MaterialsResponse,
  DraftInfo,
  AppSettings,
} from '../types/pipeline'

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

export async function getKeywords(projectId: string): Promise<ExtractResponse> {
  const { data } = await api.get(`/projects/${projectId}/keywords`)
  return data
}

// Search
export async function startSearch(
  projectId: string,
  maxRows: number = 10,
  resultsPerPlatform: number = 3
): Promise<{ task_id: string; status: string; message: string }> {
  const { data } = await api.post(`/projects/${projectId}/search`, {
    max_rows: maxRows,
    results_per_platform: resultsPerPlatform,
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
