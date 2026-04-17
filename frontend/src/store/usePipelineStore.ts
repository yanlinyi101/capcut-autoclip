import { create } from 'zustand'
import type {
  KeywordRow,
  SearchGroupResult,
  DownloadProgress,
  Platform,
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
  selectedRowIndices: Set<number>

  // Step 3
  searchStatus: 'idle' | 'running' | 'completed' | 'failed'
  searchProgress: { currentRow: number; totalRows: number; currentKeyword: string; currentPlatform: string } | null
  materials: SearchGroupResult[]
  selectedMaterialIds: Set<number>
  selectedPlatforms: Set<Platform>

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
  toggleRowSelection: (index: number) => void
  setRowSelection: (index: number, selected: boolean) => void
  updateRowKeywords: (index: number, keywords: string[]) => void
  selectAllRows: () => void
  deselectAllRows: () => void
  selectAiRecommendedRows: () => void
  setSelectedRowIndices: (indices: number[]) => void
  setSearchStatus: (status: 'idle' | 'running' | 'completed' | 'failed') => void
  setSearchProgress: (progress: { currentRow: number; totalRows: number; currentKeyword: string; currentPlatform: string } | null) => void
  addSearchResult: (result: SearchGroupResult) => void
  setMaterials: (materials: SearchGroupResult[]) => void
  toggleMaterialSelection: (id: number) => void
  selectAllYouTube: () => void
  deselectAll: () => void
  togglePlatform: (p: Platform) => void
  setSelectedPlatforms: (ps: Platform[]) => void
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
  selectedRowIndices: new Set<number>(),
  searchStatus: 'idle' as const,
  searchProgress: null,
  materials: [],
  selectedMaterialIds: new Set<number>(),
  selectedPlatforms: new Set<Platform>(['youtube', 'bilibili']),
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

  setKeywords: (rows) => {
    const selected = new Set<number>()
    for (const r of rows) {
      if (r.needs_broll) selected.add(r.index)
    }
    set({ keywords: rows, keywordsLoaded: true, selectedRowIndices: selected, currentStep: 1 })
  },

  toggleRowSelection: (index) =>
    set((state) => {
      const next = new Set(state.selectedRowIndices)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return { selectedRowIndices: next }
    }),

  setRowSelection: (index, selected) =>
    set((state) => {
      const next = new Set(state.selectedRowIndices)
      if (selected) next.add(index)
      else next.delete(index)
      return { selectedRowIndices: next }
    }),

  updateRowKeywords: (index, keywords) =>
    set((state) => ({
      keywords: state.keywords.map((r) =>
        r.index === index ? { ...r, keywords } : r
      ),
    })),

  selectAllRows: () =>
    set((state) => ({
      selectedRowIndices: new Set(state.keywords.map((r) => r.index)),
    })),

  deselectAllRows: () => set({ selectedRowIndices: new Set<number>() }),

  selectAiRecommendedRows: () =>
    set((state) => {
      const s = new Set<number>()
      for (const r of state.keywords) {
        if (r.needs_broll) s.add(r.index)
      }
      return { selectedRowIndices: s }
    }),

  setSelectedRowIndices: (indices) =>
    set({ selectedRowIndices: new Set(indices) }),

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
        for (const bili of group.bilibili_results) {
          if (bili.id != null) ids.add(bili.id)
        }
      }
      return { selectedMaterialIds: ids }
    }),

  deselectAll: () => set({ selectedMaterialIds: new Set() }),

  togglePlatform: (p) =>
    set((state) => {
      const next = new Set(state.selectedPlatforms)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return { selectedPlatforms: next }
    }),

  setSelectedPlatforms: (ps) => set({ selectedPlatforms: new Set(ps) }),

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

  reset: () => set({ ...initialState, selectedMaterialIds: new Set(), selectedRowIndices: new Set(), selectedPlatforms: new Set<Platform>(['youtube', 'bilibili']), downloads: new Map() }),
}))
