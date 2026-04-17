import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  InputNumber,
  List,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  detectBroll,
  getFrameUrl,
  getKeyframeStreamUrl,
  getKeyframes,
  getOutput,
  getRenderStreamUrl,
  getSegments,
  listPresets,
  startKeyframes,
  startRender,
} from '../services/api'
import { useSSE } from '../hooks/useSSE'
import { usePipelineStore } from '../store/usePipelineStore'
import type {
  BrollSegment,
  FrameMeta,
  KeyframeIndex,
  OutputClip,
  PlanItem,
  PresetInfo,
  Transform,
} from '../types/pipeline'

const { Text } = Typography

interface Assignment {
  material_id: number
  source_offset: number
  preset: string
  transform: Transform
  frame_path?: string
}

const DEFAULT_CANVAS = { width: 1920, height: 1080 }

const formatTime = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toFixed(1)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`
}

const EditPage: React.FC = () => {
  const navigate = useNavigate()
  const { projectId, downloads, setCurrentStep } = usePipelineStore()

  const [segments, setSegments] = useState<BrollSegment[]>([])
  const [presets, setPresets] = useState<PresetInfo[]>([])
  const [keyframes, setKeyframes] = useState<KeyframeIndex>({})
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [detecting, setDetecting] = useState(false)
  const [kfTotal, setKfTotal] = useState(0)
  const [kfDone, setKfDone] = useState(0)
  const [kfSseUrl, setKfSseUrl] = useState<string | null>(null)

  const [renderTotal, setRenderTotal] = useState(0)
  const [renderDone, setRenderDone] = useState(0)
  const [renderSseUrl, setRenderSseUrl] = useState<string | null>(null)

  const [output, setOutput] = useState<{
    output_dir: string
    readme_path: string | null
    clips: OutputClip[]
  } | null>(null)

  const downloadedMaterials = useMemo(() => {
    const list: { id: number; title: string }[] = []
    downloads.forEach((d, id) => {
      if (d.status === 'completed' && d.file_path) {
        list.push({ id, title: d.title })
      }
    })
    return list
  }, [downloads])

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }
    listPresets().then((r) => setPresets(r.presets))
    void refreshSegments()
    void refreshKeyframes()
  }, [projectId])

  const refreshSegments = async () => {
    if (!projectId) return
    const r = await getSegments(projectId)
    setSegments(r.segments)
    if (r.segments.length && !selectedId) {
      setSelectedId(r.segments[0].segment_id)
    }
  }

  const refreshKeyframes = async () => {
    if (!projectId) return
    const r = await getKeyframes(projectId)
    setKeyframes(r.index)
  }

  const handleDetect = async () => {
    if (!projectId) return
    setDetecting(true)
    try {
      const r = await detectBroll(projectId)
      setSegments(r.segments)
      if (r.segments.length) setSelectedId(r.segments[0].segment_id)
      message.success(`识别到 ${r.total} 个 B-Roll 候选段`)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '识别失败'
      message.error(m)
    } finally {
      setDetecting(false)
    }
  }

  const handleExtractKeyframes = async () => {
    if (!projectId) return
    if (!downloadedMaterials.length) {
      message.warning('请先完成素材下载')
      return
    }
    try {
      const r = await startKeyframes(projectId)
      setKfTotal(r.total_items)
      setKfDone(0)
      setKfSseUrl(getKeyframeStreamUrl(projectId))
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动失败'
      message.error(m)
    }
  }

  useSSE(kfSseUrl, {
    onProgress: () => {},
    onComplete: (data) => {
      const d = data as { processed: number; total: number; material_id: number; frames: FrameMeta[] }
      setKfDone(d.processed)
      setKeyframes((prev) => ({ ...prev, [String(d.material_id)]: d.frames }))
    },
    onAllComplete: () => {
      message.success('关键帧提取完成')
      setKfSseUrl(null)
      void refreshKeyframes()
    },
    onError: (data) => {
      const d = data as { error?: string }
      if (d.error) message.error(`关键帧错误: ${d.error}`)
    },
  })

  const selected = segments.find((s) => s.segment_id === selectedId) || null
  const assignment = selectedId ? assignments[selectedId] : undefined

  const updateAssignment = (segId: string, patch: Partial<Assignment>) => {
    setAssignments((prev) => {
      const current = prev[segId] || {
        material_id: downloadedMaterials[0]?.id ?? 0,
        source_offset: 0,
        preset: presets[0]?.id ?? 'hide_speaker',
        transform: presets[0]?.transform ?? { x: 0, y: 0, scale: 1 },
      }
      return { ...prev, [segId]: { ...current, ...patch } }
    })
  }

  const handlePickFrame = (frame: FrameMeta) => {
    if (!selected || frame.material_id == null) return
    updateAssignment(selected.segment_id, {
      material_id: frame.material_id,
      source_offset: frame.timestamp,
      frame_path: frame.frame_path,
    })
  }

  const handlePresetChange = (presetId: string) => {
    if (!selected) return
    const p = presets.find((x) => x.id === presetId)
    updateAssignment(selected.segment_id, {
      preset: presetId,
      transform: p?.transform ?? { x: 0, y: 0, scale: 1 },
    })
  }

  const handleTransformChange = (key: keyof Transform, value: number | null) => {
    if (!selected || !assignment) return
    updateAssignment(selected.segment_id, {
      transform: { ...assignment.transform, [key]: value ?? 0 },
    })
  }

  const assignedSegments = useMemo(
    () => segments.filter((s) => assignments[s.segment_id]),
    [segments, assignments]
  )

  const handleRender = async () => {
    if (!projectId) return
    if (!assignedSegments.length) {
      message.warning('请先为至少一个段落选择素材和呈现模式')
      return
    }
    const plan: PlanItem[] = assignedSegments.map((s) => {
      const a = assignments[s.segment_id]
      return {
        segment_id: s.segment_id,
        start: s.start,
        end: s.end,
        material_id: a.material_id,
        source_offset: a.source_offset,
        preset: a.preset,
        transform: a.transform,
      }
    })
    try {
      const r = await startRender(projectId, plan, DEFAULT_CANVAS.width, DEFAULT_CANVAS.height)
      setRenderTotal(r.total_items)
      setRenderDone(0)
      setRenderSseUrl(getRenderStreamUrl(projectId))
      setOutput(null)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '启动失败'
      message.error(m)
    }
  }

  useSSE(renderSseUrl, {
    onProgress: () => {},
    onComplete: (data) => {
      const d = data as { processed: number; total: number }
      setRenderDone(d.processed)
    },
    onError: (data) => {
      const d = data as { error?: string; segment_id?: string }
      if (d.error) message.error(`段 ${d.segment_id ?? ''}: ${d.error}`)
    },
    onAllComplete: async () => {
      setRenderSseUrl(null)
      if (!projectId) return
      const out = await getOutput(projectId)
      setOutput({
        output_dir: out.output_dir,
        readme_path: out.readme_path,
        clips: out.clips,
      })
      setCurrentStep(4)
      message.success(`已生成 ${out.clips.length} 个 B-Roll 片段`)
    },
  })

  if (!projectId) return null

  return (
    <div style={{ padding: '0 32px 40px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 20, margin: 0 }}>自动剪辑</h2>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>
            挑选 B-Roll 片段、关键帧、呈现模式；一键生成可拖入剪映的剪辑片段。
          </p>
        </div>
        <Space>
          <Button onClick={handleDetect} loading={detecting}>
            {segments.length ? '重新识别候选段' : '识别 B-Roll 候选段'}
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={handleExtractKeyframes}
            disabled={!!kfSseUrl}
          >
            提取关键帧
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleRender}
            disabled={!!renderSseUrl || !assignedSegments.length}
          >
            一键生成 ({assignedSegments.length}/{segments.length})
          </Button>
        </Space>
      </div>

      {!downloadedMaterials.length && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="当前没有已下载的素材。请先完成 Step 4（下载），然后再回到这里。"
        />
      )}

      {kfSseUrl && kfTotal > 0 && (
        <Progress
          percent={Math.round((kfDone / kfTotal) * 100)}
          status="active"
          format={() => `关键帧 ${kfDone}/${kfTotal}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {renderSseUrl && renderTotal > 0 && (
        <Progress
          percent={Math.round((renderDone / renderTotal) * 100)}
          status="active"
          format={() => `剪辑 ${renderDone}/${renderTotal}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 300px', gap: 16 }}>
        {/* Left: segments */}
        <Card title={`候选段 (${segments.length})`} styles={{ body: { padding: 0, maxHeight: 560, overflowY: 'auto' } }}>
          {!segments.length && <Empty style={{ padding: 32 }} description="尚未识别" />}
          <List
            dataSource={segments}
            renderItem={(s) => {
              const assigned = !!assignments[s.segment_id]
              return (
                <List.Item
                  onClick={() => setSelectedId(s.segment_id)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    background: selectedId === s.segment_id ? '#1f2d3d' : 'transparent',
                    borderLeft: assigned ? '3px solid #52c41a' : '3px solid transparent',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong style={{ color: '#fff' }}>{s.segment_id}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatTime(s.start)} · {s.duration.toFixed(1)}s
                      </Text>
                    </div>
                    <Text style={{ color: '#ccc', fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {s.text.slice(0, 60)}
                    </Text>
                    <Space size={4} wrap>
                      {s.keywords.slice(0, 3).map((k) => (
                        <Tag key={k} color="blue" style={{ margin: 0 }}>{k}</Tag>
                      ))}
                    </Space>
                  </div>
                </List.Item>
              )
            }}
          />
        </Card>

        {/* Middle: keyframes */}
        <Card
          title={selected ? `选择关键帧 — ${selected.segment_id}` : '选择关键帧'}
          styles={{ body: { padding: 16, maxHeight: 560, overflowY: 'auto' } }}
        >
          {!selected && <Empty description="请选择左侧的一个候选段" />}
          {selected && !Object.keys(keyframes).length && (
            <Empty description="暂无关键帧，请点击右上角「提取关键帧」" />
          )}
          {selected && Object.keys(keyframes).length > 0 && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {Object.entries(keyframes).map(([mid, frames]) => {
                const mat = downloadedMaterials.find((m) => m.id === Number(mid))
                return (
                  <div key={mid}>
                    <Text strong style={{ color: '#fff' }}>素材 #{mid} — {mat?.title ?? ''}</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
                      {frames.map((f) => {
                        const picked = assignment?.frame_path === f.frame_path
                        return (
                          <div
                            key={f.frame_path}
                            onClick={() => handlePickFrame({ ...f, material_id: Number(mid) })}
                            style={{
                              cursor: 'pointer',
                              border: picked ? '2px solid #4facfe' : '2px solid transparent',
                              borderRadius: 6,
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            <img
                              src={getFrameUrl(projectId, f.frame_path)}
                              alt={`frame ${f.scene_idx}`}
                              style={{ width: '100%', display: 'block' }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                fontSize: 11,
                                padding: '2px 6px',
                              }}
                            >
                              {formatTime(f.timestamp)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </Space>
          )}
        </Card>

        {/* Right: preset + transform */}
        <Card title="呈现模式" styles={{ body: { padding: 16 } }}>
          {!selected && <Empty description="请选择一段" />}
          {selected && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">当前段 (字幕)</Text>
                <div style={{ color: '#fff', marginTop: 4, fontSize: 13 }}>{selected.text}</div>
              </div>

              <div>
                <Text type="secondary">预设</Text>
                <Select
                  value={assignment?.preset ?? presets[0]?.id}
                  onChange={handlePresetChange}
                  options={presets.map((p) => ({ label: p.label, value: p.id }))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <Text type="secondary">位置 / 缩放（画布中心为 0,0）</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                  <InputNumber
                    addonBefore="x"
                    step={0.02}
                    min={-1}
                    max={1}
                    value={assignment?.transform.x ?? 0}
                    onChange={(v) => handleTransformChange('x', v)}
                  />
                  <InputNumber
                    addonBefore="y"
                    step={0.02}
                    min={-1}
                    max={1}
                    value={assignment?.transform.y ?? 0}
                    onChange={(v) => handleTransformChange('y', v)}
                  />
                  <InputNumber
                    addonBefore="s"
                    step={0.05}
                    min={0.1}
                    max={2}
                    value={assignment?.transform.scale ?? 1}
                    onChange={(v) => handleTransformChange('scale', v)}
                  />
                </div>
              </div>

              <div>
                <Text type="secondary">已选素材</Text>
                <div style={{ color: '#fff', marginTop: 4, fontSize: 12 }}>
                  {assignment
                    ? `#${assignment.material_id} @ ${formatTime(assignment.source_offset)}`
                    : '未选'}
                </div>
              </div>
            </Space>
          )}
        </Card>
      </div>

      {output && (
        <Card title="输出结果" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text style={{ color: '#fff' }}>
              输出目录：<code>{output.output_dir}</code>
            </Text>
            {output.readme_path && (
              <Text style={{ color: '#fff' }}>
                拖拽指引：<code>{output.readme_path}</code>
              </Text>
            )}
            <List
              size="small"
              dataSource={output.clips}
              renderItem={(c) => (
                <List.Item>
                  <Space>
                    <Tag color="blue">{c.segment_id}</Tag>
                    <Text>{formatTime(c.timeline_start)} → {formatTime(c.timeline_end)}</Text>
                    <Tag>{c.preset}</Tag>
                    <code>{c.clip_rel}</code>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        </Card>
      )}
    </div>
  )
}

export default EditPage
