import React from 'react'
import { Layout, Button } from 'antd'
import { SettingOutlined, HomeOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AntHeader
      className="glass-effect"
      style={{
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(20px)',
        background: 'rgba(26, 26, 26, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
        onClick={() => navigate('/')}
      >
        <span
          style={{
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            filter: 'drop-shadow(0 2px 4px rgba(79, 172, 254, 0.2))',
          }}
        >
          CapCut Autoclip
        </span>
        <span style={{ color: '#666', fontSize: '13px', marginLeft: '12px' }}>
          剪映 B-Roll 素材助手
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!isHome && (
          <Button
            type="primary"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '8px',
              height: '40px',
              padding: '0 20px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)',
            }}
          >
            首页
          </Button>
        )}
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={() => navigate('/settings')}
          style={{ color: '#cccccc', borderRadius: '8px', height: '40px', padding: '0 16px' }}
        >
          设置
        </Button>
      </div>
    </AntHeader>
  )
}

export default Header
