import React, { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Button, message, Card, Spin, Divider, Select } from 'antd'
import { SaveOutlined, ToolOutlined, FolderOpenOutlined, ScanOutlined, AudioOutlined } from '@ant-design/icons'
import { getSettings, updateSettings } from '../services/api'
import type { AppSettings } from '../types/pipeline'

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const s = await getSettings()
      form.setFieldsValue(s)
    } catch {
      message.error('无法加载设置')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: AppSettings) => {
    setSaving(true)
    try {
      await updateSettings(values)
      message.success('设置已保存')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 32px 40px', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '24px' }}>
        <ToolOutlined style={{ marginRight: '8px', color: '#4facfe' }} />
        设置
      </h2>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        {/* JianYing path section */}
        <Card
          title={
            <span>
              <ScanOutlined style={{ marginRight: '8px', color: '#4facfe' }} />
              剪映草稿扫描
            </span>
          }
          style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '16px',
            marginBottom: '20px',
          }}
          headStyle={{
            background: '#1a1a1a',
            borderBottom: '1px solid #2d2d2d',
            color: '#fff',
          }}
        >
          <Form.Item
            label="剪映草稿目录路径"
            name="jianying_draft_path"
            extra="系统将自动扫描此目录下的所有剪映草稿工程"
          >
            <Input
              prefix={<FolderOpenOutlined style={{ color: '#4facfe' }} />}
              placeholder="例如: /Users/xxx/Movies/JianyingPro/User Data/Projects/com.lveditor.draft"
            />
          </Form.Item>

          <div style={{ color: '#888', fontSize: '12px', marginTop: '-8px' }}>
            <p style={{ margin: '0 0 4px' }}>macOS 常见路径:</p>
            <code style={{ color: '#4facfe', background: '#0f0f0f', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
              ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft
            </code>
          </div>
        </Card>

        {/* Search & download section */}
        <Card
          title={
            <span>
              <ToolOutlined style={{ marginRight: '8px', color: '#4facfe' }} />
              搜索与下载
            </span>
          }
          style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '16px',
          }}
          headStyle={{
            background: '#1a1a1a',
            borderBottom: '1px solid #2d2d2d',
            color: '#fff',
          }}
        >
          <Form.Item label="yt-dlp 路径" name="yt_dlp_path">
            <Input placeholder="yt-dlp" />
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item label="每次搜索处理行数" name="max_search_rows" style={{ flex: 1 }}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="每平台结果数" name="results_per_platform" style={{ flex: 1 }}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item label="下载格式" name="download_format">
            <Input placeholder="bestvideo+bestaudio/best" />
          </Form.Item>
        </Card>

        {/* ASR section */}
        <Card
          title={
            <span>
              <AudioOutlined style={{ marginRight: '8px', color: '#4facfe' }} />
              语音识别 (ASR)
            </span>
          }
          style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '16px',
            marginTop: '20px',
          }}
          headStyle={{
            background: '#1a1a1a',
            borderBottom: '1px solid #2d2d2d',
            color: '#fff',
          }}
        >
          <Form.Item label="ASR 方式" name="asr_method">
            <Select
              options={[
                { label: 'bcut-asr (B站语音识别，免费在线)', value: 'bcut' },
                { label: 'Whisper (OpenAI 本地模型)', value: 'whisper' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.asr_method !== cur.asr_method}
          >
            {({ getFieldValue }) =>
              getFieldValue('asr_method') === 'whisper' ? (
                <Form.Item label="Whisper 模型" name="whisper_model">
                  <Select
                    options={[
                      { label: 'tiny (最快，精度低)', value: 'tiny' },
                      { label: 'base (推荐)', value: 'base' },
                      { label: 'small', value: 'small' },
                      { label: 'medium', value: 'medium' },
                      { label: 'large (最慢，精度高)', value: 'large' },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item label="语言" name="language" style={{ flex: 1 }}>
              <Select
                options={[
                  { label: '中文', value: 'zh' },
                  { label: 'English', value: 'en' },
                  { label: '日本語', value: 'ja' },
                  { label: '自动检测', value: 'auto' },
                ]}
              />
            </Form.Item>
            <Form.Item label="ffmpeg 路径" name="ffmpeg_path" style={{ flex: 1 }}>
              <Input placeholder="ffmpeg" />
            </Form.Item>
          </div>
        </Card>

        <Divider style={{ margin: '24px 0' }} />

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              width: '100%',
              height: '44px',
            }}
          >
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default SettingsPage
