import React, { useEffect, useState } from 'react'
import { Spin, Empty, message, Alert, Button } from 'antd'
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import DraftCard from '../components/DraftCard'
import { listDrafts, initProject } from '../services/api'
import { usePipelineStore } from '../store/usePipelineStore'
import type { DraftInfo } from '../types/pipeline'

const InitPage: React.FC = () => {
  const navigate = useNavigate()
  const setProject = usePipelineStore((s) => s.setProject)
  const [drafts, setDrafts] = useState<DraftInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [scanPath, setScanPath] = useState('')
  const [scanError, setScanError] = useState('')
  const [initing, setIniting] = useState<string | null>(null)

  const loadDrafts = async () => {
    setLoading(true)
    setScanError('')
    try {
      const res = await listDrafts()
      setDrafts(res.drafts)
      setScanPath(res.scan_path)
      if (res.error) setScanError(res.error)
    } catch {
      setScanError('无法连接后端服务')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
  }, [])

  const handleSelect = async (draft: DraftInfo) => {
    // Allow any draft to be selected; ExtractPage handles missing SRT/video
    setIniting(draft.draft_id)
    try {
      const res = await initProject(draft.draft_path)
      setProject(res.project_id, res.project_path, res.srt_path, res.video_path, res.has_srt, res.has_video)
      message.success(`已绑定: ${draft.draft_name}`)
      navigate('/extract')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '初始化失败'
      message.error(msg)
    } finally {
      setIniting(null)
    }
  }

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>
            选择剪映草稿
          </h2>
          <p style={{ color: '#888', fontSize: '13px', margin: '4px 0 0' }}>
            从本地剪映工程中选择一个草稿，开始自动搜索 B-Roll 素材
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={<ReloadOutlined />} onClick={loadDrafts} loading={loading}>
            刷新
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
            设置扫描路径
          </Button>
        </div>
      </div>

      {/* Scan path info */}
      {scanPath && !scanError && (
        <div style={{ marginBottom: '16px', color: '#666', fontSize: '12px' }}>
          扫描路径: <code style={{ color: '#4facfe' }}>{scanPath}</code>
        </div>
      )}

      {scanError && (
        <Alert
          type="warning"
          showIcon
          message={scanError}
          description={
            <span>
              请在 <a onClick={() => navigate('/settings')} style={{ color: '#4facfe' }}>设置</a> 中配置正确的剪映草稿目录路径
            </span>
          }
          style={{ marginBottom: '20px' }}
        />
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="正在扫描本地剪映草稿..." />
        </div>
      )}

      {/* Empty */}
      {!loading && drafts.length === 0 && !scanError && (
        <Empty
          description="未发现剪映草稿工程"
          style={{ padding: '80px 0' }}
        />
      )}

      {/* Draft grid */}
      {!loading && drafts.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {drafts.map((draft) => (
            <div key={draft.draft_id} style={{ position: 'relative' }}>
              {initing === draft.draft_id && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '12px',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Spin tip="初始化中..." />
                </div>
              )}
              <DraftCard draft={draft} onClick={handleSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default InitPage
