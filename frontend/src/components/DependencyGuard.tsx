import React, { useEffect, useState } from 'react'
import { Modal, Alert, Button, Typography, Space, Spin, Tag, Divider, message } from 'antd'
import {
  ExclamationCircleFilled,
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { checkDependencies } from '../services/api'
import type { DependencyCheck } from '../services/api'

const { Text, Paragraph } = Typography

const INSTALL_INSTRUCTIONS: Record<string, { label: string; commands: { title: string; cmd: string }[] }> = {
  'yt-dlp': {
    label: 'yt-dlp (YouTube 视频下载器)',
    commands: [
      { title: 'macOS (Homebrew，推荐)', cmd: 'brew install yt-dlp' },
      { title: '通过 pip', cmd: 'pip install -U yt-dlp' },
    ],
  },
  'ffmpeg': {
    label: 'ffmpeg (视频处理)',
    commands: [
      { title: 'macOS (Homebrew，推荐)', cmd: 'brew install ffmpeg' },
    ],
  },
}

const CopyableCmd: React.FC<{ title: string; cmd: string }> = ({ title, cmd }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{title}</div>
    <div
      style={{
        background: '#0f0f0f',
        border: '1px solid #2d2d2d',
        borderRadius: 6,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <code style={{ color: '#4facfe', fontFamily: 'monospace', fontSize: 13 }}>{cmd}</code>
      <Button
        type="text"
        size="small"
        icon={<CopyOutlined />}
        onClick={() => {
          navigator.clipboard.writeText(cmd)
          message.success('已复制')
        }}
      >
        复制
      </Button>
    </div>
  </div>
)

const DependencyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [check, setCheck] = useState<DependencyCheck | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const r = await checkDependencies()
      setCheck(r)
    } catch {
      setCheck(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    run()
  }, [])

  const blocking = !loading && check && !check.ok && !dismissed
  const showWarning = !loading && check && check.ok && !check.llm.deepseek_configured

  return (
    <>
      {children}

      {showWarning && (
        <Alert
          type="warning"
          banner
          showIcon
          message={
            <span>
              未配置 DeepSeek API Key，AI 分析 B-Roll 需求将降级到规则判定。前往{' '}
              <a href="/settings">设置</a> 配置后效果更佳。
            </span>
          }
          closable
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999 }}
        />
      )}

      <Modal
        open={!!blocking}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: '#faad14', marginRight: 8 }} />
            缺少系统依赖
          </span>
        }
        width={640}
        closable={false}
        footer={
          <Space>
            <Button onClick={() => setDismissed(true)}>暂时跳过 (部分功能不可用)</Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={run} loading={loading}>
              已安装，重新检测
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : check ? (
          <div>
            <Paragraph style={{ color: '#888' }}>
              以下依赖必须先安装才能正常使用搜索与下载功能。在终端执行下方命令，然后点"已安装，重新检测"。
            </Paragraph>

            {check.critical_missing.map((name) => {
              const info = INSTALL_INSTRUCTIONS[name]
              if (!info) return null
              return (
                <div key={name} style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 10 }}>
                    <Tag color="error" icon={<CloseCircleFilled />}>
                      未安装
                    </Tag>
                    <Text strong style={{ fontSize: 14 }}>
                      {info.label}
                    </Text>
                  </div>
                  {info.commands.map((c, i) => (
                    <CopyableCmd key={i} title={c.title} cmd={c.cmd} />
                  ))}
                </div>
              )
            })}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ fontSize: 12, color: '#888' }}>
              <div style={{ marginBottom: 4 }}>已安装：</div>
              {Object.entries(check.tools).map(([k, v]) => (
                <Tag
                  key={k}
                  color={v.installed ? 'success' : 'default'}
                  icon={v.installed ? <CheckCircleFilled /> : <CloseCircleFilled />}
                  style={{ marginBottom: 4 }}
                >
                  {k} {v.version ? `· ${v.version}` : ''}
                </Tag>
              ))}
            </div>
          </div>
        ) : (
          <Alert type="error" message="无法连接后端" description="请确认 uvicorn 已启动 (端口 8000)。" />
        )}
      </Modal>
    </>
  )
}

export default DependencyGuard
