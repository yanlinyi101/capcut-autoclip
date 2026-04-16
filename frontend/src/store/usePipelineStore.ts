import { create } from 'zustand'
import type {
  KeywordRow,
  SearchGroupResult,
  DownloadProgress,
} from '../types/pipeline'

interface PipelineState {
  // Step 1
  projectId: string | null
  projectPath: string
  srtPath: string
  videoPath: string
  hasSrt: boolean
  hasVideo: boolean
  hasValidProject: boolean

  // Step 2
  keywords: KeywordRow[]
  keywordsLoaded: boolean

  // Step 3
  searchStatus: 'idle' | 'running' | 'completed' | 'failed'
  searchProgress: { currentRow: number; totalRows: number; currentKeyword: string; currentPlatform: string } | null
  materials: SearchGroupResult[]
  selectedMaterialIds: Set<number>

  // Step 4
  downloadStatus: 'idle' | 'running' | 'completed'
  downloads: Map<number, DownloadProgress>

  // UI
  currentStep: number
  loading: boolean
  error: string | null

  // Actions
  setProject: (projectId: string, projectPath: string, srtPath: string, videoPath: string, hasSrt: boolean, hasVideo: boolean) => void
  setKeywords: (rows: KeywordRow[]) => void
  setSearchStatus: (status: 'idle' | 'running' | 'completed' | 'failed') => void
  setSearchProgress: (progress: { currentRow: number; totalRows: number; currentKeyword: string; currentPlatform: string } | null) => void
  addSearchResult: (result: SearchGroupResult) => void
  setMaterials: (materials: SearchGroupResult[]) => void
  toggleMaterialSelection: (id: number) => void
  selectAllYouTube: () => void
  deselectAll: () => void
  setDownloadStatus: (status: 'idle' | 'running' | 'completed') => void
  updateDownloadProgress: (materialId: number, update: DownloadProgress) => void
  setCurrentStep: (step: number) => void
  setLoading: (loading: boolean) => void
  setSrtReady: (srtPath: string) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  projectId: null,
  projectPath: '',
  srtPath: '',
  videoPath: '',
  hasSrt: false,
  hasVideo: false,
  hasValidProject: false,
  keywords: [],
  keywordsLoaded: false,
  searchStatus: 'idle' as const,
  searchProgress: null,
  materials: [],
  selectedMaterialIds: new Set<number>(),
  downloadStatus: 'idle' as const,
  downloads: new Map<number, DownloadProgress>(),
  currentStep: 0,
  loading: false,
  error: null,
}

export const usePipelineStore = create<PipelineState>((set) => ({
  ...initialState,

  setProject: (projectId, projectPath, srtPath, videoPath, hasSrt, hasVideo) =>
    set({ projectId, projectPath, srtPath, videoPath, hasSrt, hasVideo, hasValidProject: true, currentStep: 1 }),

  setKeywords: (rows) =>
    set({ keywords: rows, keywordsLoaded: true, currentStep: 1 }),

  setSearchStatus: (status) => set({ searchStatus: status }),

  setSearchProgress: (progress) => set({ searchProgress: progress }),

  addSearchResult: (result) =>
    set((state) => ({ materials: [...state.materials, result] })),

  setMaterials: (materials) => set({ materials }),

  toggleMaterialSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedMaterialIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedMaterialIds: next }
    }),

  selectAllYouTube: () =>
    set((state) => {
      const ids = new Set<number>()
      for (const group of state.materials) {
        for (const yt of group.youtube_results) {
          if (yt.id != null) ids.add(yt.id)
        }
      }
      return { selectedMaterialIds: ids }
    }),

  deselectAll: () => set({ selectedMaterialIds: new Set() }),

  setDownloadStatus: (status) => set({ downloadStatus: status }),

  updateDownloadProgress: (materialId, update) =>
    set((state) => {
      const next = new Map(state.downloads)
      next.set(materialId, update)
      return { downloads: next }
    }),

  setCurrentStep: (step) => set({ currentStep: step }),

  setLoading: (loading) => set({ loading }),

  setSrtReady: (srtPath) => set({ srtPath, hasSrt: true }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState, selectedMaterialIds: new Set(), downloads: new Map() }),
}))
