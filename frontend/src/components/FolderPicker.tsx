import React, { useState } from 'react'
import { Input, Button, Space, Tag, message } from 'antd'
import { FolderOpenOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { initProject } from '../services/api'
import { usePipelineStore } from '../store/usePipelineStore'
import { useNavigate } from 'react-router-dom'

const FolderPicker: React.FC = () => {
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const setProject = usePipelineStore((s) => s.setProject)
  const navigate = useNavigate()

  const handleInit = async () => {
    if (!path.trim()) {
      message.warning('请输入路径')
      return
    }
    setLoading(true)
    try {
      const res = await initProject(path.trim())
      setProject(res.project_id, res.project_path, res.srt_path, res.video_path, res.has_srt, res.has_video)
      message.success('项目初始化成功')
      navigate('/extract')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '初始化失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>
          绑定剪映草稿工程
        </h2>
        <p style={{ color: '#888', fontSize: '14px' }}>
          请输入剪映草稿工程文件夹的绝对路径，系统将自动检测工程文件
        </p>
      </div>

      <Space.Compact style={{ width: '100%', marginBottom: '16px' }}>
        <Input
          size="large"
          prefix={<FolderOpenOutlined style={{ color: '#4facfe' }} />}
          placeholder="请输入剪映草稿工程文件夹的绝对路径"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onPressEnter={handleInit}
          style={{ fontSize: '14px' }}
        />
        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={handleInit}
          icon={loading ? <LoadingOutlined /> : undefined}
          style={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            border: 'none',
            fontWeight: 500,
          }}
        >
          初始化项目
        </Button>
      </Space.Compact>

      <div style={{ color: '#666', fontSize: '12px', marginBottom: '16px' }}>
        <p>示例路径：</p>
        <code style={{ color: '#4facfe', background: '#1a1a1a', padding: '4px 8px', borderRadius: '4px' }}>
          /Users/xxx/Movies/JianYing Media/UserData/Projects/com.lveditor.draft/草稿名称
        </code>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Tag icon={<CheckCircleOutlined />} color="green">
          需要包含 draft_content.json
        </Tag>
        <Tag icon={<CheckCircleOutlined />} color="blue">
          需要包含字幕脚本文件
        </Tag>
      </div>
    </div>
  )
}

export default FolderPicker
