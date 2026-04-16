import React from 'react'
import { Tag, Tooltip } from 'antd'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  AudioOutlined,
} from '@ant-design/icons'
import type { DraftInfo } from '../types/pipeline'
import { getCoverUrl } from '../services/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  draft: DraftInfo
  onClick: (draft: DraftInfo) => void
}

function formatDuration(sec: number): string {
  if (sec <= 0) return '--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '--'
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${bytes}B`
}

const DraftCard: React.FC<Props> = ({ draft, onClick }) => {
  const coverUrl = draft.has_cover ? getCoverUrl(draft.cover_path) : ''
  const hasSrt = draft.has_srt && draft.srt_has_content
  const canGenerate = !hasSrt && draft.has_video

  return (
    <div
      onClick={() => onClick(draft)}
      style={{
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(79, 172, 254, 0.2), 0 4px 8px rgba(0, 0, 0, 0.3)'
        e.currentTarget.style.borderColor = 'rgba(79, 172, 254, 0.5)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
      }}
    >
      {/* Cover */}
      <div
        style={{
          height: '140px',
          position: 'relative',
          overflow: 'hidden',
          background: coverUrl
            ? `url(${coverUrl}) center/cover`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        }}
      >
        {/* Duration badge */}
        {draft.duration_seconds > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              color: '#fff',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <VideoCameraOutlined />
            {formatDuration(draft.duration_seconds)}
          </div>
        )}

        {/* Subtitle status badge */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
          }}
        >
          {hasSrt ? (
            <Tag
              color="green"
              style={{
                margin: 0,
                fontSize: '11px',
                borderRadius: '4px',
                border: 'none',
                background: 'rgba(82, 196, 26, 0.85)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
              }}
            >
              <FileTextOutlined /> 有字幕
            </Tag>
          ) : canGenerate ? (
            <Tooltip title="有视频文件，可通过语音识别自动生成字幕">
              <Tag
                style={{
                  margin: 0,
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'rgba(79, 172, 254, 0.85)',
                  color: '#fff',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <AudioOutlined /> 可生成
              </Tag>
            </Tooltip>
          ) : (
            <Tooltip title="无字幕文件且无视频，无法提取关键词">
              <Tag
                style={{
                  margin: 0,
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'rgba(100, 100, 100, 0.8)',
                  color: '#aaa',
                  backdropFilter: 'blur(4px)',
                }}
              >
                无字幕
              </Tag>
            </Tooltip>
          )}
        </div>

        {/* Time overlay */}
        {draft.modified_at && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ClockCircleOutlined />
            {dayjs(draft.modified_at).fromNow()}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#fff',
            marginBottom: '6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {draft.draft_name}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{formatSize(draft.materials_size)}</span>
          {draft.is_ai_shorts && (
            <Tag
              style={{
                margin: 0,
                fontSize: '10px',
                lineHeight: '16px',
                padding: '0 4px',
                borderRadius: '3px',
                background: 'rgba(79, 172, 254, 0.15)',
                border: '1px solid rgba(79, 172, 254, 0.3)',
                color: '#4facfe',
              }}
            >
              AI
            </Tag>
          )}
        </div>
      </div>
    </div>
  )
}

export default DraftCard
