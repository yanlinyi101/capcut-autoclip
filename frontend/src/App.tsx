import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import Header from './components/Header'
import StepIndicator from './components/StepIndicator'
import InitPage from './pages/InitPage'
import ExtractPage from './pages/ExtractPage'
import SearchPage from './pages/SearchPage'
import DownloadPage from './pages/DownloadPage'
import EditPage from './pages/EditPage'
import SettingsPage from './pages/SettingsPage'
import { usePipelineStore } from './store/usePipelineStore'
import DependencyGuard from './components/DependencyGuard'

const { Content } = Layout

function App() {
  const currentStep = usePipelineStore((s) => s.currentStep)

  return (
    <DependencyGuard>
      <Layout>
        <Header />
        <StepIndicator currentStep={currentStep} />
        <Content>
          <Routes>
            <Route path="/" element={<InitPage />} />
            <Route path="/extract" element={<ExtractPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/edit" element={<EditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Content>
      </Layout>
    </DependencyGuard>
  )
}

export default App
