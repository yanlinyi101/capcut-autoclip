import React, { useEffect, useState } from 'react'
import { message, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import DownloadProgressList from '../components/DownloadProgress'
import { startDownload, getDownloadStreamUrl } from '../services/api'
import { useSSE } from '../hooks/useSSE'
import { usePipelineStore } from '../store/usePipelineStore'
import type { DownloadProgress as DP, DownloadComplete } from '../types/pipeline'

const DownloadPage: React.FC = () => {
  const navigate = useNavigate()
  const {
    projectId,
    selectedMaterialIds,
    downloads,
    downloadStatus,
    setDownloadStatus,
    updateDownloadProgress,
    setCurrentStep,
  } = usePipelineStore()

  const [sseUrl, setSseUrl] = useState<string | null>(null)
  const materialIds = Array.from(selectedMaterialIds).sort((a, b) => a - b)

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    if (materialIds.length === 0) {
      navigate('/search')
      return
    }
    if (downloadStatus === 'idle') {
      handleStartDownload()
    }
  }, [projectId])

  const handleStartDownload = async () => {
    if (!projectId) return
    setDownloadStatus('running')

    // Initialize all items as waiting
    for (const id of materialIds) {
      updateDownloadProgress(id, {
        material_id: id,
        title: `素材 #${id}`,
        status: 'waiting',
        percent: 0,
      })
    }

    try {
      await startDownload(projectId, materialIds)
      setSseUrl(getDownloadStreamUrl(projectId))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动下载失败'
      message.error(msg)
      setDownloadStatus('idle')
    }
  }

  useSSE(sseUrl, {
    onProgress: (data) => {
      const d = data as DP
      updateDownloadProgress(d.material_id, d)
    },
    onComplete: (data) => {
      const d = data as DP
      updateDownloadProgress(d.material_id, d)
    },
    onError: (data) => {
      const d = data as DP
      updateDownloadProgress(d.material_id, d)
    },
    onAllComplete: (data) => {
      const d = data as DownloadComplete
      setDownloadStatus('completed')
      setCurrentStep(3)
      setSseUrl(null)
      message.success(`下载完成: ${d.completed} 成功, ${d.failed} 失败`)
    },
  })

  if (!projectId) return null

  if (materialIds.length === 0) {
    return (
      <div style={{ padding: '80px 32px', textAlign: 'center' }}>
        <Empty description="请先选择要下载的素材" />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 32px 40px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>下载素材</h2>
        <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>
          正在下载选中的 {materialIds.length} 个 YouTube 视频素材
        </p>
      </div>

      <DownloadProgressList downloads={downloads} totalItems={materialIds.length} />
    </div>
  )
}

export default DownloadPage
