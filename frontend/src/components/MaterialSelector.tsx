import React from 'react'
import { Button, Tag } from 'antd'
import MaterialCard from './MaterialCard'
import type { SearchGroupResult } from '../types/pipeline'
import { usePipelineStore } from '../store/usePipelineStore'

interface Props {
  materials: SearchGroupResult[]
}

const MaterialSelector: React.FC<Props> = ({ materials }) => {
  const { selectedMaterialIds, toggleMaterialSelection } = usePipelineStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {materials.map((group, gi) => (
        <div key={gi}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              padding: '12px 16px',
              background: '#1a1a1a',
              borderRadius: '8px',
              border: '1px solid #2d2d2d',
            }}
          >
            <Tag color="blue" style={{ margin: 0, fontFamily: 'monospace' }}>
              {group.start_time}
            </Tag>
            <span style={{ color: '#4facfe', fontWeight: 600 }}>{group.keyword}</span>
            <span style={{ color: '#666', fontSize: '13px', flex: 1 }}>
              {group.original_text}
            </span>
          </div>

          {group.douyin_results.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: '#888', fontSize: '12px', fontWeight: 500, marginBottom: '8px', paddingLeft: '4px' }}>
                抖音精选
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.douyin_results.map((item, i) => (
                  <MaterialCard key={`dy-${i}`} item={item} />
                ))}
              </div>
            </div>
          )}

          {group.youtube_results.length > 0 && (
            <div>
              <div style={{ color: '#888', fontSize: '12px', fontWeight: 500, marginBottom: '8px', paddingLeft: '4px' }}>
                YouTube 精选（可下载）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.youtube_results.map((item, i) => (
                  <MaterialCard
                    key={`yt-${i}`}
                    item={item}
                    selected={item.id != null && selectedMaterialIds.has(item.id)}
                    onToggle={toggleMaterialSelection}
                  />
                ))}
              </div>
            </div>
          )}

          {group.youtube_results.length === 0 && group.douyin_results.length === 0 && (
            <div style={{ color: '#666', padding: '16px', textAlign: 'center' }}>
              暂无搜索结果
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default MaterialSelector
