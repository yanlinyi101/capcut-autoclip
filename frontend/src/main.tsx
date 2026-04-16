import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#4facfe',
        borderRadius: 8,
        colorBgContainer: '#1a1a1a',
        colorBgElevated: '#1a1a1a',
        colorBorder: '#2d2d2d',
        colorText: '#ffffff',
        colorTextSecondary: '#cccccc',
      },
    }}
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ConfigProvider>
)
