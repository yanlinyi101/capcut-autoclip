import React, { useEffect, useState, useRef } from 'react'
import { Button, message, Spin, Empty, Steps, Card, Input } from 'antd'
import { SearchOutlined, AudioOutlined, LoadingOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import KeywordsTable from '../components/KeywordsTable'
import { extractKeywords, generateSrt, getSrtStreamUrl } from '../services/api'
import { usePipelineStore } from '../store/usePipelineStore'

const ExtractPage: React.FC = () => {
  const navigate = useNavigate()
  const { projectId, hasSrt, hasVideo, keywords, keywordsLoaded, setKeywords, setCurrentStep, setSrtReady } = usePipelineStore()
  const [loading, setLoading] = useState(false)
  const [asrStage, setAsrStage] = useState<string | null>(null)
  const [asrMessage, setAsrMessage] = useState('')
  const [asrRunning, setAsrRunning] = useState(false)
  const [manualVideoPath, setManualVideoPath] = useState('')
  const [useManualVideo, setUseManualVideo] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    if (hasSrt && !keywordsLoaded) {
      handleExtract()
    }
  }, [projectId, hasSrt])

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const handleExtract = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await extractKeywords(projectId)
      setKeywords(res.keywords)
      setCurrentStep(1)
      message.success(`成功提取 ${res.total_rows} 条关键词`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '提取失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSrt = async () => {
    if (!projectId) return
    setAsrRunning(true)
    setAsrStage('starting')
    setAsrMessage('正在启动语音识别...')

    try {
      const videoPath = manualVideoPath.trim() || undefined
    const res = await generateSrt(projectId, videoPath)
      const taskId = res.task_id

      const es = new EventSource(getSrtStreamUrl(projectId, taskId))
      eventSourceRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setAsrStage(data.stage || e.type)
          setAsrMessage(data.message || '')

          if (data.stage === 'completed') {
            es.close()
            setAsrRunning(false)
            setSrtReady(data.srt_path || '')
            message.success('字幕生成完成')
            // Auto-trigger keyword extraction
            handleExtract()
          } else if (data.stage === 'failed') {
            es.close()
            setAsrRunning(false)
            message.error(data.error || '字幕生成失败')
          }
        } catch {
          // ignore parse errors
        }
      }

      es.addEventListener('extracting_audio', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setAsrStage('extracting_audio')
        setAsrMessage(data.message || '正在提取音频...')
      })

      es.addEventListener('audio_ready', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setAsrStage('audio_ready')
        setAsrMessage(data.message || '音频提取完成')
      })

      es.addEventListener('recognizing', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        setAsrStage('recognizing')
        setAsrMessage(data.message || '正在识别...')
      })

      es.addEventListener('completed', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        es.close()
        setAsrRunning(false)
        setAsrStage('completed')
        setSrtReady(data.srt_path || '')
        message.success('字幕生成完成')
        handleExtract()
      })

      es.addEventListener('failed', (e: MessageEvent) => {
        const data = JSON.parse(e.data)
        es.close()
        setAsrRunning(false)
        setAsrStage('failed')
        message.error(data.error || '字幕生成失败')
      })

      es.onerror = () => {
        es.close()
        setAsrRunning(false)
      }
    } catch (err: unknown) {
      setAsrRunning(false)
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动 ASR 失败'
      message.error(msg)
    }
  }

  const handleGoSearch = () => {
    setCurrentStep(2)
    navigate('/search')
  }

  if (!projectId) return null

  const asrStepIndex = asrStage === 'extracting_audio' ? 0
    : asrStage === 'audio_ready' ? 1
    : asrStage === 'recognizing' ? 1
    : asrStage === 'completed' ? 2
    : 0

  // Show ASR generation UI when no SRT (with or without auto-detected video)
  if (!hasSrt) {
    return (
      <div style={{ padding: '0 32px 40px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>生成字幕</h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>
            {hasVideo ? '此草稿没有字幕文件，需要通过语音识别自动生成' : '指定视频文件路径，通过语音识别自动生成字幕'}
          </p>
        </div>

        <Card
          style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '16px',
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          {asrRunning ? (
            <div style={{ padding: '20px 0' }}>
              <Steps
                current={asrStepIndex}
                items={[
                  { title: '提取音频', description: asrStepIndex === 0 ? asrMessage : '' },
                  { title: '语音识别', description: asrStepIndex === 1 ? asrMessage : '' },
                  { title: '生成完成' },
                ]}
                style={{ marginBottom: '32px' }}
              />
              <div style={{ textAlign: 'center' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                <p style={{ color: '#888', marginTop: '16px' }}>{asrMessage}</p>
              </div>
            </div>
          ) : asrStage === 'failed' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>字幕生成失败，请检查设置后重试</p>
              <Button
                type="primary"
                icon={<AudioOutlined />}
                onClick={handleGenerateSrt}
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  border: 'none',
                  height: '44px',
                  padding: '0 28px',
                }}
              >
                重新生成字幕
              </Button>
            </div>
          ) : (
            <div style={{ padding: '20px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: hasVideo ? '24px' : '16px' }}>
                <AudioOutlined style={{ fontSize: '48px', color: '#4facfe', marginBottom: '12px' }} />
                <p style={{ color: '#ccc', fontSize: '15px' }}>
                  {hasVideo ? '将从视频中自动提取音频并进行语音识别' : '请指定视频文件路径，系统将自动识别字幕'}
                </p>
              </div>

              {!hasVideo && (
                <div style={{ marginBottom: '24px' }}>
                  <Input
                    size="large"
                    prefix={<FolderOpenOutlined style={{ color: '#4facfe' }} />}
                    placeholder="视频文件绝对路径，例如: /Users/xxx/Movies/video.mp4"
                    value={manualVideoPath}
                    onChange={(e) => setManualVideoPath(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    支持格式: mp4, mov, avi, mkv, flv, wmv
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <Button
                  type="primary"
                  icon={<AudioOutlined />}
                  onClick={handleGenerateSrt}
                  disabled={!hasVideo && !manualVideoPath.trim()}
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    border: 'none',
                    height: '44px',
                    padding: '0 28px',
                    fontWeight: 500,
                    boxShadow: '0 2px 12px rgba(79, 172, 254, 0.3)',
                  }}
                >
                  开始生成字幕
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // Normal flow: has SRT, show keywords
  return (
    <div style={{ padding: '0 32px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>关键词时间轴</h2>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0' }}>
            从字幕中提取的名词关键词，将用于搜索 B-Roll 素材
          </p>
        </div>

        {!loading && (
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleGoSearch}
            disabled={keywords.length === 0}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              height: '44px',
              padding: '0 28px',
              fontWeight: 500,
              boxShadow: '0 2px 12px rgba(79, 172, 254, 0.3)',
            }}
          >
            开始搜索素材
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" tip="正在提取关键词..." />
        </div>
      ) : keywords.length > 0 ? (
        <KeywordsTable keywords={keywords} />
      ) : (
        <Empty description="暂无关键词" style={{ padding: '80px 0' }} />
      )}
    </div>
  )
}

export default ExtractPage
