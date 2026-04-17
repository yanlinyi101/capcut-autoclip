import React from 'react'
import { Progress, Tag } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import type { DownloadProgress as DP } from '../types/pipeline'

interface Props {
  downloads: Map<number, DP>
  totalItems: number
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  waiting: { color: '#666', icon: <ClockCircleOutlined /> },
  downloading: { color: '#4facfe', icon: <LoadingOutlined /> },
  completed: { color: '#52c41a', icon: <CheckCircleFilled /> },
  failed: { color: '#ff6b6b', icon: <CloseCircleFilled /> },
}

const statusLabels: Record<string, string> = {
  waiting: '等待中',
  downloading: '下载中',
  completed: '已完成',
  failed: '失败',
}

const DownloadProgressList: React.FC<Props> = ({ downloads, totalItems }) => {
  const items = Array.from(downloads.values())
  const completed = items.filter((d) => d.status === 'completed').length
  const failed = items.filter((d) => d.status === 'failed').length
  const downloading = items.filter((d) => d.status === 'downloading').length
  const waiting = items.filter((d) => d.status === 'waiting').length
  const partial = items
    .filter((d) => d.status === 'downloading')
    .reduce((s, d) => s + (d.percent || 0) / 100, 0)
  const overallPercent =
    totalItems > 0
      ? Math.min(100, Math.round(((completed + failed + partial) / totalItems) * 100))
      : 0
  const allDone = completed + failed >= totalItems && totalItems > 0

  return (
    <div>
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #2d2d2d',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ color: '#fff', fontWeight: 500 }}>
            总进度: {completed + failed}/{totalItems}
          </span>
          <span style={{ color: '#888', fontSize: 13 }}>
            {completed > 0 && <span style={{ color: '#52c41a', marginRight: 10 }}>✓ {completed} 成功</span>}
            {downloading > 0 && <span style={{ color: '#4facfe', marginRight: 10 }}>⇣ {downloading} 下载中</span>}
            {waiting > 0 && <span style={{ color: '#999', marginRight: 10 }}>⏱ {waiting} 等待</span>}
            {failed > 0 && <span style={{ color: '#ff6b6b' }}>✗ {failed} 失败</span>}
          </span>
        </div>
        <Progress
          percent={overallPercent}
          status={allDone ? (failed > 0 ? 'exception' : 'success') : 'active'}
          strokeColor={{ '0%': '#4facfe', '100%': '#00f2fe' }}
          trailColor="#2d2d2d"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item) => {
          const cfg = statusConfig[item.status] || statusConfig.waiting
          return (
            <div
              key={item.material_id}
              style={{
                background: '#1a1a1a',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #2d2d2d',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag color="blue" style={{ margin: 0, borderRadius: '10px', fontSize: '11px', padding: '0 8px' }}>
                    ID: {item.material_id}
                  </Tag>
                  <span style={{ color: '#eee', fontSize: '14px' }}>{item.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: cfg.color }}>
                  {cfg.icon}
                  <span style={{ fontSize: '13px' }}>{statusLabels[item.status]}</span>
                  {item.file_size && (
                    <span style={{ color: '#888', fontSize: '12px' }}>({item.file_size})</span>
                  )}
                </div>
              </div>

              {item.status === 'downloading' && (
                <Progress
                  percent={item.percent}
                  strokeColor="#4facfe"
                  trailColor="#2d2d2d"
                  size="small"
                />
              )}

              {item.status === 'completed' && (
                <Progress percent={100} strokeColor="#52c41a" trailColor="#2d2d2d" size="small" />
              )}

              {item.status === 'failed' && item.error && (
                <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '4px' }}>
                  {item.error}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DownloadProgressList
