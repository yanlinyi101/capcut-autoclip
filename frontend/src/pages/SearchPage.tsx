import React, { useEffect, useState } from 'react'
import { Button, message, Spin } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import MaterialSelector from '../components/MaterialSelector'
import { startSearch, getSearchStreamUrl } from '../services/api'
import { useSSE } from '../hooks/useSSE'
import { usePipelineStore } from '../store/usePipelineStore'
import type { SearchGroupResult, SearchProgress as SP } from '../types/pipeline'

const SearchPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    projectId,
    materials,
    searchStatus,
    searchProgress,
    selectedMaterialIds,
    setSearchStatus,
    setSearchProgress,
    addSearchResult,
    setCurrentStep,
    selectAllYouTube,
    deselectAll,
  } = usePipelineStore()

  const [sseUrl, setSseUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    if (searchStatus === 'idle') {
      handleStartSearch()
    }
  }, [projectId])

  const handleStartSearch = async () => {
    if (!projectId) return
    setSearchStatus('running')
    try {
      await startSearch(projectId)
      setSseUrl(getSearchStreamUrl(projectId))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动搜索失败'
      message.error(msg)
      setSearchStatus('failed')
    }
  }

  useSSE(sseUrl, {
    onProgress: (data) => {
      const d = data as SP
      setSearchProgress({
        currentRow: d.row_index,
        totalRows: d.total_rows,
        currentKeyword: d.keyword,
        currentPlatform: d.platform,
      })
    },
    onResult: (data) => {
      addSearchResult(data as SearchGroupResult)
    },
    onComplete: () => {
      setSearchStatus('completed')
      setSearchProgress(null)
      setSseUrl(null)
      setCurrentStep(2)
      message.success('素材搜索完成')
    },
  })

  const handleGoDownload = () => {
    if (selectedMaterialIds.size === 0) {
      message.warning('请先选择要下载的 YouTube 素材')
      return
    }
    setCurrentStep(3)
    navigate('/download')
  }

  if (!projectId) return null

  return (
    <div style={{ padding: '0 32px 120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>搜索素材</h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>
            在 YouTube 和抖音搜索匹配的 B-Roll 视频素材
          </p>
        </div>

        {searchStatus === 'completed' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={() => selectedMaterialIds.size > 0 ? deselectAll() : selectAllYouTube()}>
              {selectedMaterialIds.size > 0 ? '取消全选' : '全选 YouTube'}
            </Button>
          </div>
        )}
      </div>

      {searchStatus === 'running' && searchProgress && (
        <div
          style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #2d2d2d',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <Spin />
          <div>
            <div style={{ color: '#fff', fontWeight: 500 }}>
              正在搜索 ({searchProgress.currentRow + 1}/{searchProgress.totalRows})
            </div>
            <div style={{ color: '#888', fontSize: '13px' }}>
              关键词: {searchProgress.currentKeyword} · 平台: {searchProgress.currentPlatform}
            </div>
          </div>
        </div>
      )}

      <MaterialSelector materials={materials} />

      {selectedMaterialIds.size > 0 && (
        <div className="floating-bar">
          <span style={{ color: '#fff' }}>
            已选择 <span style={{ color: '#4facfe', fontWeight: 600 }}>{selectedMaterialIds.size}</span> 个 YouTube 素材
          </span>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleGoDownload}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              height: '44px',
              padding: '0 28px',
              fontWeight: 500,
            }}
          >
            下载选中素材
          </Button>
        </div>
      )}
    </div>
  )
}

export default SearchPage
