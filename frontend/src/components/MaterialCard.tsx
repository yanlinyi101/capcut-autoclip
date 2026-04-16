import React from 'react'
import { Checkbox, Tag } from 'antd'
import { YoutubeFilled, LinkOutlined } from '@ant-design/icons'
import type { MaterialItem } from '../types/pipeline'

interface Props {
  item: MaterialItem
  selected?: boolean
  onToggle?: (id: number) => void
}

const MaterialCard: React.FC<Props> = ({ item, selected, onToggle }) => {
  const isYouTube = item.platform === 'YouTube'

  return (
    <div
      className="material-card"
      style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        borderColor: selected ? '#4facfe' : '#2d2d2d',
      }}
    >
      {isYouTube && item.id != null && (
        <Checkbox
          checked={selected}
          onChange={() => onToggle?.(item.id!)}
          style={{ marginTop: '2px' }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          {isYouTube ? (
            <YoutubeFilled style={{ color: '#ff4444', fontSize: '16px' }} />
          ) : (
            <span style={{ fontSize: '14px' }}>🎵</span>
          )}
          {isYouTube && item.id != null && (
            <Tag
              color="blue"
              style={{
                margin: 0,
                borderRadius: '10px',
                fontSize: '11px',
                lineHeight: '18px',
                padding: '0 8px',
              }}
            >
              ID: {item.id}
            </Tag>
          )}
          <Tag style={{ margin: 0 }}>{item.platform}</Tag>
          {item.duration && (
            <span style={{ color: '#888', fontSize: '12px' }}>{item.duration}</span>
          )}
        </div>

        <div style={{ fontSize: '14px', color: '#eee', marginBottom: '4px', lineHeight: 1.5 }}>
          {item.title}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#4facfe', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <LinkOutlined /> 打开链接
        </a>
      </div>
    </div>
  )
}

export default MaterialCard
