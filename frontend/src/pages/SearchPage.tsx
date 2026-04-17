import React, { useEffect, useState } from 'react'
import { Button, message, Progress, Card } from 'antd'
import { DownloadOutlined, LoadingOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons'
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
    selectedPlatforms,
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
      const platforms = Array.from(selectedPlatforms)
      await startSearch(projectId, 3, platforms)
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
      message.warning('请先选择要下载的素材')
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
            在 {Array.from(selectedPlatforms).map((p) => p === 'youtube' ? 'YouTube' : 'Bilibili').join(' 和 ')} 搜索匹配的 B-Roll 视频素材
          </p>
        </div>

        {searchStatus === 'completed' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={() => selectedMaterialIds.size > 0 ? deselectAll() : selectAllYouTube()}>
              {selectedMaterialIds.size > 0 ? '取消全选' : '全选'}
            </Button>
          </div>
        )}
      </div>

      {searchStatus === 'running' && (() => {
        const row = searchProgress?.currentRow ?? 0
        const total = searchProgress?.totalRows ?? 0
        const doneCount = materials.length
        const percent = total > 0 ? Math.min(99, Math.round(((row + 0.5) / total) * 100)) : 0
        return (
          <Card
            style={{ background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: 12, marginBottom: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <LoadingOutlined style={{ color: '#4facfe', fontSize: 20 }} spin />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 500 }}>
                  {searchProgress
                    ? `正在搜索 (${row + 1}/${total}) · 已完成 ${doneCount} 行`
                    : '正在启动搜索任务...'}
                </div>
                <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>
                  {searchProgress
                    ? `关键词: ${searchProgress.currentKeyword} · 平台: ${searchProgress.currentPlatform}`
                    : '首次启动 yt-dlp 可能需要几秒钟...'}
                </div>
              </div>
            </div>
            <Progress
              percent={percent}
              status="active"
              strokeColor={{ '0%': '#4facfe', '100%': '#00f2fe' }}
              showInfo
            />
          </Card>
        )
      })()}

      {searchStatus === 'failed' && (
        <Card style={{ background: '#1a1a1a', border: '1px solid #3a1f1f', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ExclamationCircleOutlined style={{ color: '#ff6b6b', fontSize: 24 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 500 }}>搜索任务启动失败</div>
              <div style={{ color: '#888', fontSize: 13 }}>可能原因：后端重启丢失项目、未勾选关键词行、或 yt-dlp 未安装</div>
            </div>
            <Button icon={<ReloadOutlined />} onClick={handleStartSearch}>重试</Button>
          </div>
        </Card>
      )}

      <MaterialSelector materials={materials} />

      {selectedMaterialIds.size > 0 && (
        <div className="floating-bar">
          <span style={{ color: '#fff' }}>
            已选择 <span style={{ color: '#4facfe', fontWeight: 600 }}>{selectedMaterialIds.size}</span> 个素材
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
