import React, { useEffect, useState, useRef } from 'react'
import { Button, message, Spin, Empty, Steps, Card, Progress, List, Segmented, Checkbox, Tooltip } from 'antd'
import type { Platform } from '../types/pipeline'
import {
  SearchOutlined,
  AudioOutlined,
  LoadingOutlined,
  InboxOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import Upload from 'antd/es/upload'
import type { UploadProps, RcFile } from 'antd/es/upload'
import { useNavigate } from 'react-router-dom'
import KeywordsTable from '../components/KeywordsTable'
import {
  startExtract,
  getExtractStreamUrl,
  generateSrt,
  getSrtStreamUrl,
  uploadExportedVideo,
  getRecentExports,
  uploadSrt,
  useSrtPath,
  getRecentSrt,
} from '../services/api'
import type { KeywordRow } from '../types/pipeline'
import type { RecentExportItem } from '../services/api'
import { usePipelineStore } from '../store/usePipelineStore'

const { Dragger } = Upload

type InputMode = 'srt' | 'video'

const fmtSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const fmtMtime = (ts: number): string => {
  const diffHr = (Date.now() / 1000 - ts) / 3600
  if (diffHr < 1) return '刚刚'
  if (diffHr < 24) return `${Math.floor(diffHr)} 小时前`
  return `${Math.floor(diffHr / 24)} 天前`
}

const RecentList: React.FC<{
  items: RecentExportItem[]
  loading: boolean
  onSelect: (path: string) => void
}> = ({ items, loading, onSelect }) => {
  if (loading) return <div style={{ textAlign: 'center', padding: '16px' }}><Spin size="small" /></div>
  if (items.length === 0) return <Empty description={<span style={{ color: '#666' }}>未发现近期文件</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <List.Item
          onClick={() => onSelect(item.path)}
          style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', borderBottom: '1px solid #252525' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#202020')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#fff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                {item.source_dir} · {fmtSize(item.size_bytes)} · {fmtMtime(item.mtime)}
              </div>
            </div>
            <Button type="link" size="small">使用</Button>
          </div>
        </List.Item>
      )}
    />
  )
}

const ExtractPage: React.FC = () => {
  const navigate = useNavigate()
  const { projectId, hasSrt, hasVideo, keywords, keywordsLoaded, setKeywords, setCurrentStep, setSrtReady } = usePipelineStore()
  const selectedCount = usePipelineStore((s) => s.selectedRowIndices.size)
  const selectedPlatforms = usePipelineStore((s) => s.selectedPlatforms)
  const setSelectedPlatforms = usePipelineStore((s) => s.setSelectedPlatforms)

  const [loading, setLoading] = useState(false)
  const [extractPercent, setExtractPercent] = useState(0)
  const [extractStage, setExtractStage] = useState<string>('')
  const [extractMessage, setExtractMessage] = useState<string>('')
  const [asrStage, setAsrStage] = useState<string | null>(null)
  const [asrMessage, setAsrMessage] = useState('')
  const [asrRunning, setAsrRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)

  const [inputMode, setInputMode] = useState<InputMode>('srt')
  const [recentVideos, setRecentVideos] = useState<RecentExportItem[]>([])
  const [recentSrts, setRecentSrts] = useState<RecentExportItem[]>([])
  const [recentVideosLoading, setRecentVideosLoading] = useState(false)
  const [recentSrtsLoading, setRecentSrtsLoading] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!projectId) { navigate('/'); return }
    if (hasSrt && !keywordsLoaded) handleExtract()
  }, [projectId, hasSrt])

  useEffect(() => {
    if (!projectId || hasSrt || hasVideo) return
    setRecentSrtsLoading(true)
    getRecentSrt(projectId).then((r) => setRecentSrts(r.items)).catch(() => setRecentSrts([])).finally(() => setRecentSrtsLoading(false))
    setRecentVideosLoading(true)
    getRecentExports(projectId).then((r) => setRecentVideos(r.items)).catch(() => setRecentVideos([])).finally(() => setRecentVideosLoading(false))
  }, [projectId, hasSrt, hasVideo])

  useEffect(() => () => { eventSourceRef.current?.close() }, [])

  const handleExtract = async () => {
    if (!projectId) return
    setLoading(true)
    setExtractPercent(0)
    setExtractStage('starting')
    setExtractMessage('正在启动任务...')
    try {
      const res = await startExtract(projectId)
      const es = new EventSource(getExtractStreamUrl(projectId, res.task_id))
      eventSourceRef.current?.close()
      eventSourceRef.current = es

      const onProgress = (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data)
          if (typeof d.percent === 'number') setExtractPercent(d.percent)
          if (d.stage) setExtractStage(d.stage)
          if (d.message) setExtractMessage(d.message)
        } catch { /* ignore */ }
      }
      es.addEventListener('progress', onProgress)
      es.addEventListener('complete', (e: MessageEvent) => {
        try {
          const d = JSON.parse(e.data)
          setExtractPercent(100)
          setExtractStage('complete')
          setExtractMessage(d.message || '完成')
          if (Array.isArray(d.keywords)) {
            setKeywords(d.keywords as KeywordRow[])
          }
          setCurrentStep(1)
          message.success(d.message || `成功提取 ${d.total || 0} 行`)
        } catch { /* ignore */ }
        es.close()
        setLoading(false)
      })
      es.addEventListener('error', (e: MessageEvent) => {
        try {
          const d = JSON.parse((e as MessageEvent).data || '{}')
          message.error(d.error || '提取失败')
          setExtractMessage(d.error || '提取失败')
        } catch {
          message.error('提取任务连接中断')
        }
        es.close()
        setLoading(false)
      })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '提取失败'
      message.error(msg)
      setLoading(false)
    }
  }

  // Called after SRT is ready (either uploaded or path-linked)
  const handleSrtReady = (srtPath: string) => {
    setSrtReady(srtPath)
    message.success('SRT 已导入，正在提取关键词...')
    handleExtract()
  }

  // SRT upload via Dragger
  const handleSrtUpload = async (file: RcFile) => {
    if (!projectId) return
    setUploading(true)
    setUploadPercent(0)
    try {
      const res = await uploadSrt(projectId, file, setUploadPercent)
      setUploading(false)
      handleSrtReady(res.srt_path)
    } catch (err: unknown) {
      setUploading(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '上传失败'
      message.error(msg)
    }
  }

  // SRT selected from recent list (server-side path)
  const handleSrtPathSelect = async (path: string) => {
    if (!projectId) return
    try {
      const res = await useSrtPath(projectId, path)
      handleSrtReady(res.srt_path)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '导入失败'
      message.error(msg)
    }
  }

  // Video upload then ASR
  const handleVideoUpload = async (file: RcFile) => {
    if (!projectId) return
    setUploading(true)
    setUploadPercent(0)
    try {
      const res = await uploadExportedVideo(projectId, file, setUploadPercent)
      setUploading(false)
      runAsr(res.video_path)
    } catch (err: unknown) {
      setUploading(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '上传失败'
      message.error(msg)
    }
  }

  const runAsr = async (videoPath?: string) => {
    if (!projectId) return
    setAsrRunning(true)
    setAsrStage('starting')
    setAsrMessage('正在启动语音识别...')
    try {
      const res = await generateSrt(projectId, videoPath)
      const es = new EventSource(getSrtStreamUrl(projectId, res.task_id))
      eventSourceRef.current = es

      es.addEventListener('extracting_audio', (e: MessageEvent) => { const d = JSON.parse(e.data); setAsrStage('extracting_audio'); setAsrMessage(d.message || '正在提取音频...') })
      es.addEventListener('audio_ready', (e: MessageEvent) => { const d = JSON.parse(e.data); setAsrStage('audio_ready'); setAsrMessage(d.message || '音频提取完成') })
      es.addEventListener('recognizing', (e: MessageEvent) => { const d = JSON.parse(e.data); setAsrStage('recognizing'); setAsrMessage(d.message || '正在识别...') })
      es.addEventListener('completed', (e: MessageEvent) => {
        const d = JSON.parse(e.data)
        es.close(); setAsrRunning(false); setAsrStage('completed')
        setSrtReady(d.srt_path || '')
        message.success('字幕生成完成')
        handleExtract()
      })
      es.addEventListener('failed', (e: MessageEvent) => {
        const d = JSON.parse(e.data)
        es.close(); setAsrRunning(false); setAsrStage('failed')
        message.error(d.error || '字幕生成失败')
      })
      es.onerror = () => { es.close(); setAsrRunning(false) }
    } catch (err: unknown) {
      setAsrRunning(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动 ASR 失败'
      message.error(msg)
    }
  }

  const srtDraggerProps: UploadProps = {
    name: 'file', multiple: false, accept: '.srt', showUploadList: false,
    beforeUpload: (file) => { handleSrtUpload(file as RcFile); return false },
    disabled: uploading || loading,
  }

  const videoDraggerProps: UploadProps = {
    name: 'file', multiple: false, accept: '.mp4,.mov,.mkv,.avi,.flv,.wmv,.m4v', showUploadList: false,
    beforeUpload: (file) => { handleVideoUpload(file as RcFile); return false },
    disabled: uploading || asrRunning,
  }

  const handleGoSearch = () => { setCurrentStep(2); navigate('/search') }

  if (!projectId) return null

  const asrStepIndex = asrStage === 'extracting_audio' ? 0 : asrStage === 'audio_ready' || asrStage === 'recognizing' ? 1 : asrStage === 'completed' ? 2 : 0

  // ── ASR running / hasVideo auto-start ────────────────────────────────────────
  if (!hasSrt) {
    const busy = uploading || asrRunning || loading

    return (
      <div style={{ padding: '0 32px 40px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>生成字幕</h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>
            {hasVideo ? '检测到工程视频，可直接 ASR 识别，或导入剪映导出的 SRT 字幕' : '导入 SRT 字幕文件，或上传剪映导出的成品视频走 ASR 识别'}
          </p>
        </div>

        <Card style={{ background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '16px', maxWidth: '720px', margin: '0 auto' }}>

          {/* ASR in progress */}
          {asrRunning ? (
            <div style={{ padding: '20px 0' }}>
              <Steps current={asrStepIndex} items={[
                { title: '提取音频', description: asrStepIndex === 0 ? asrMessage : '' },
                { title: '语音识别', description: asrStepIndex === 1 ? asrMessage : '' },
                { title: '生成完成' },
              ]} style={{ marginBottom: '32px' }} />
              <div style={{ textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                <p style={{ color: '#888', marginTop: '16px' }}>{asrMessage}</p>
              </div>
            </div>

          ) : asrStage === 'failed' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>字幕生成失败，请检查设置后重试</p>
              <Button type="primary" icon={<AudioOutlined />} onClick={() => runAsr()} disabled={!hasVideo}>重新生成字幕</Button>
            </div>

          ) : uploading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Progress type="circle" percent={uploadPercent} strokeColor="#4facfe" />
              <p style={{ color: '#888', marginTop: '16px' }}>正在上传...</p>
            </div>

          ) : (
            <>
              {/* Mode switcher */}
              {!hasVideo && (
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                  <Segmented
                    value={inputMode}
                    onChange={(v) => setInputMode(v as InputMode)}
                    disabled={busy}
                    options={[
                      { label: <span><FileTextOutlined /> 导入 SRT 字幕</span>, value: 'srt' },
                      { label: <span><VideoCameraOutlined /> 上传视频 (ASR)</span>, value: 'video' },
                    ]}
                  />
                </div>
              )}

              {/* hasVideo: show ASR button + SRT import option */}
              {hasVideo ? (
                <div style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <Button
                      type="primary" icon={<AudioOutlined />} onClick={() => runAsr()} size="large"
                      style={{ flex: 1, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: 'none', height: '44px', fontWeight: 500 }}
                    >
                      ASR 自动识别字幕
                    </Button>
                  </div>
                  <div style={{ color: '#888', fontSize: '12px', textAlign: 'center', marginBottom: '16px' }}>— 或直接导入剪映导出的 SRT 字幕文件 —</div>
                  <Dragger {...srtDraggerProps} style={{ background: '#141414', border: '1px dashed #3a3a3a', borderRadius: '12px' }}>
                    <p className="ant-upload-drag-icon"><FileTextOutlined style={{ color: '#4facfe', fontSize: '36px' }} /></p>
                    <p className="ant-upload-text" style={{ color: '#fff' }}>拖拽剪映导出的 .srt 文件，或点击选择</p>
                  </Dragger>
                  <div style={{ marginTop: '16px', color: '#ccc', fontSize: '13px', marginBottom: '8px' }}>
                    <FileTextOutlined /> 最近 SRT 文件
                  </div>
                  <RecentList items={recentSrts} loading={recentSrtsLoading} onSelect={handleSrtPathSelect} />
                </div>
              ) : inputMode === 'srt' ? (
                /* SRT mode */
                <div>
                  <Dragger {...srtDraggerProps} style={{ background: '#141414', border: '1px dashed #3a3a3a', borderRadius: '12px', marginBottom: '24px' }}>
                    <p className="ant-upload-drag-icon"><FileTextOutlined style={{ color: '#4facfe', fontSize: '48px' }} /></p>
                    <p className="ant-upload-text" style={{ color: '#fff' }}>拖拽剪映导出的 .srt 字幕文件，或点击选择</p>
                    <p className="ant-upload-hint" style={{ color: '#888' }}>在剪映：导出 → 字幕 → SRT；上传后直接提取关键词，无需 ASR</p>
                  </Dragger>
                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}><FileTextOutlined /> 最近 SRT 文件（Desktop / Downloads / Movies，近 30 天）</div>
                  <RecentList items={recentSrts} loading={recentSrtsLoading} onSelect={handleSrtPathSelect} />
                </div>
              ) : (
                /* Video / ASR mode */
                <div>
                  <Dragger {...videoDraggerProps} style={{ background: '#141414', border: '1px dashed #3a3a3a', borderRadius: '12px', marginBottom: '24px' }}>
                    <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#4facfe', fontSize: '48px' }} /></p>
                    <p className="ant-upload-text" style={{ color: '#fff' }}>拖拽剪映导出的成品视频，或点击选择</p>
                    <p className="ant-upload-hint" style={{ color: '#888' }}>支持 mp4 / mov / mkv；上传后自动走 ASR 识别字幕</p>
                  </Dragger>
                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}><VideoCameraOutlined /> 最近导出视频（近 7 天）</div>
                  <RecentList items={recentVideos} loading={recentVideosLoading} onSelect={(path) => runAsr(path)} />
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    )
  }

  // ── has SRT: show keywords ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 32px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>关键词时间轴</h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>从字幕中提取的名词关键词，将用于搜索 B-Roll 素材</p>
        </div>
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Tooltip title="选择素材来源平台">
              <Checkbox.Group
                value={Array.from(selectedPlatforms)}
                onChange={(vals) => setSelectedPlatforms(vals as Platform[])}
                options={[
                  { label: 'YouTube', value: 'youtube' },
                  { label: 'Bilibili', value: 'bilibili' },
                ]}
              />
            </Tooltip>
            <Button
              type="primary" icon={<SearchOutlined />} onClick={handleGoSearch}
              disabled={keywords.length === 0 || selectedCount === 0 || selectedPlatforms.size === 0}
              size="large"
              style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', border: 'none', height: '44px', padding: '0 28px', fontWeight: 500, boxShadow: '0 2px 12px rgba(79, 172, 254, 0.3)' }}
            >
              开始搜索 (已选 {selectedCount} 行)
            </Button>
          </div>
        )}
      </div>
      {loading ? (
        <Card style={{ background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: 16, padding: '32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>
              {extractStage === 'parsing' && '解析 SRT 字幕中...'}
              {extractStage === 'jieba_done' && '关键词提取完成，开始 AI 分析...'}
              {extractStage === 'llm' && 'AI 分析 B-Roll 需求中...'}
              {extractStage === 'complete' && '完成！'}
              {(!extractStage || extractStage === 'starting') && '正在启动任务...'}
            </div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{extractMessage}</div>
            <Progress
              percent={extractPercent}
              status={extractStage === 'complete' ? 'success' : 'active'}
              strokeColor={{ '0%': '#4facfe', '100%': '#00f2fe' }}
              style={{ maxWidth: 480, margin: '0 auto' }}
            />
          </div>
        </Card>
      ) : keywords.length > 0 && projectId ? (
        <KeywordsTable keywords={keywords} projectId={projectId} />
      ) : (
        <Empty description="暂无关键词" style={{ padding: '80px 0' }} />
      )}
    </div>
  )
}

export default ExtractPage
