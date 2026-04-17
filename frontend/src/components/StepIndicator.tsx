import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpenOutlined,
  FileSearchOutlined,
  SearchOutlined,
  DownloadOutlined,
  ScissorOutlined,
  CheckCircleFilled,
} from '@ant-design/icons'

const steps = [
  { label: '绑定工程', icon: <FolderOpenOutlined />, path: '/' },
  { label: '提取关键词', icon: <FileSearchOutlined />, path: '/extract' },
  { label: '搜索素材', icon: <SearchOutlined />, path: '/search' },
  { label: '下载素材', icon: <DownloadOutlined />, path: '/download' },
  { label: '自动剪辑', icon: <ScissorOutlined />, path: '/edit' },
]

interface Props {
  currentStep: number
}

const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  const navigate = useNavigate()

  return (
    <div
      style={{
        background: '#1a1a1a',
        borderRadius: '16px',
        padding: '20px 32px',
        margin: '24px 32px',
        border: '1px solid #2d2d2d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {steps.map((step, i) => {
        const isActive = i === currentStep
        const isCompleted = i < currentStep
        const isFuture = i > currentStep

        return (
          <React.Fragment key={i}>
            <div
              onClick={() => isCompleted && navigate(step.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: isCompleted ? 'pointer' : 'default',
                opacity: isFuture ? 0.4 : 1,
                transition: 'all 0.3s ease',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  background: isActive
                    ? 'linear-gradient(135deg, #4facfe, #00f2fe)'
                    : isCompleted
                    ? 'rgba(82, 196, 26, 0.15)'
                    : '#2d2d2d',
                  color: isActive ? '#fff' : isCompleted ? '#52c41a' : '#666',
                  border: isCompleted ? '1px solid #52c41a' : '1px solid transparent',
                }}
              >
                {isCompleted ? <CheckCircleFilled /> : step.icon}
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#4facfe' : isCompleted ? '#52c41a' : '#666',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  margin: '0 16px',
                  background: i < currentStep ? '#52c41a' : '#2d2d2d',
                  borderRadius: '1px',
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default StepIndicator
