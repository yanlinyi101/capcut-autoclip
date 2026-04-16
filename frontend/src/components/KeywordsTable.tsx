import React from 'react'
import { Table, Tag } from 'antd'
import type { KeywordRow } from '../types/pipeline'

interface Props {
  keywords: KeywordRow[]
}

const KeywordsTable: React.FC<Props> = ({ keywords }) => {
  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (v: number) => <span style={{ color: '#888' }}>{v + 1}</span>,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 100,
      render: (v: string) => <span style={{ color: '#4facfe', fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 100,
      render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
    },
    {
      title: '字幕文本',
      dataIndex: 'text',
      key: 'text',
      ellipsis: true,
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      width: 280,
      render: (kws: string[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {kws.map((kw, i) => (
            <Tag key={i} color="blue" style={{ margin: 0 }}>
              {kw}
            </Tag>
          ))}
        </div>
      ),
    },
  ]

  return (
    <Table
      dataSource={keywords}
      columns={columns}
      rowKey="index"
      pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
      size="middle"
      style={{ borderRadius: '12px', overflow: 'hidden' }}
    />
  )
}

export default KeywordsTable
