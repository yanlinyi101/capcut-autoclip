import React, { useState, useRef, useEffect } from 'react'
import { Table, Tag, Checkbox, Button, Input, Space, Tooltip, message } from 'antd'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons'
import type { InputRef } from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import type { KeywordRow } from '../types/pipeline'
import { usePipelineStore } from '../store/usePipelineStore'
import { patchKeywordRow, bulkSelectRows } from '../services/api'

const stripFlag = (raw: string): string => raw.replace(/\(\w+\)$/, '').trim()

interface EditableTagsProps {
  row: KeywordRow
  projectId: string
}

const EditableTags: React.FC<EditableTagsProps> = ({ row, projectId }) => {
  const updateRowKeywords = usePipelineStore((s) => s.updateRowKeywords)
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const persist = async (next: string[]) => {
    updateRowKeywords(row.index, next)
    try {
      await patchKeywordRow(projectId, row.index, { keywords: next })
    } catch (e) {
      message.error('保存关键词失败')
    }
  }

  const handleRemove = (idx: number) => {
    const next = row.keywords.filter((_, i) => i !== idx)
    persist(next)
  }

  const handleAdd = () => {
    const v = input.trim()
    if (v && !row.keywords.some((k) => stripFlag(k) === v)) {
      persist([...row.keywords, v])
    }
    setInput('')
    setAdding(false)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {row.keywords.map((kw, i) => (
        <Tag
          key={`${row.index}-${i}`}
          color="blue"
          closable
          onClose={(e) => {
            e.preventDefault()
            handleRemove(i)
          }}
          closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
          style={{ margin: 0 }}
        >
          {stripFlag(kw)}
        </Tag>
      ))}
      {adding ? (
        <Input
          ref={inputRef}
          size="small"
          style={{ width: 90 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={handleAdd}
          onPressEnter={handleAdd}
        />
      ) : (
        <Tag
          onClick={() => setAdding(true)}
          style={{ background: '#fff', borderStyle: 'dashed', cursor: 'pointer', margin: 0 }}
        >
          <PlusOutlined /> 新增
        </Tag>
      )}
    </div>
  )
}

interface Props {
  keywords: KeywordRow[]
  projectId: string
}

const KeywordsTable: React.FC<Props> = ({ keywords, projectId }) => {
  const selectedRowIndices = usePipelineStore((s) => s.selectedRowIndices)
  const toggleRowSelection = usePipelineStore((s) => s.toggleRowSelection)
  const setSelectedRowIndices = usePipelineStore((s) => s.setSelectedRowIndices)

  const handleToggle = async (rowIndex: number, e: CheckboxChangeEvent) => {
    const checked = e.target.checked
    toggleRowSelection(rowIndex)
    try {
      await patchKeywordRow(projectId, rowIndex, { selected: checked })
    } catch {
      message.error('同步勾选状态失败')
    }
  }

  const handleBulk = async (mode: 'all' | 'none' | 'ai_recommended') => {
    try {
      const res = await bulkSelectRows(projectId, mode)
      setSelectedRowIndices(res.selected_row_indices)
    } catch {
      message.error('批量操作失败')
    }
  }

  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (v: number) => <span style={{ color: '#888' }}>{v + 1}</span>,
    },
    {
      title: '开始',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 90,
      render: (v: string) => <span style={{ color: '#4facfe', fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '结束',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 90,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
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
      width: 320,
      render: (_: string[], row: KeywordRow) => <EditableTags row={row} projectId={projectId} />,
    },
    {
      title: 'B-Roll',
      key: 'broll',
      width: 140,
      render: (_: unknown, row: KeywordRow) => {
        const checked = selectedRowIndices.has(row.index)
        const reason = row.broll_reason || (row.needs_broll ? 'AI 推荐' : '')
        return (
          <Tooltip title={reason || '点击勾选以搜索此行'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Checkbox checked={checked} onChange={(e) => handleToggle(row.index, e)} />
              {reason && (
                <span style={{ color: '#999', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {reason}
                </span>
              )}
            </div>
          </Tooltip>
        )
      },
    },
  ]

  const total = keywords.length
  const selected = selectedRowIndices.size

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          padding: '8px 12px',
          background: '#fafafa',
          borderRadius: 8,
        }}
      >
        <Space>
          <Button size="small" onClick={() => handleBulk('all')}>
            全选
          </Button>
          <Button size="small" onClick={() => handleBulk('none')}>
            取消全选
          </Button>
          <Button size="small" type="primary" ghost onClick={() => handleBulk('ai_recommended')}>
            只选 AI 推荐
          </Button>
        </Space>
        <span style={{ color: '#666', fontSize: 13 }}>
          已选 <strong style={{ color: '#1677ff' }}>{selected}</strong> / 共 {total} 行
        </span>
      </div>
      <Table
        dataSource={keywords}
        columns={columns}
        rowKey="index"
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
        style={{ borderRadius: 12, overflow: 'hidden' }}
      />
    </div>
  )
}

export default KeywordsTable
