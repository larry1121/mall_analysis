import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import HomePage from './pages/HomePage'
import ResultPage from './pages/ResultPage'
import PrintPage from './pages/PrintPage'
import PrintResultPage from './pages/PrintResultPage'
import './styles/print.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function ResultPageWrapper() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  
  const handleBack = () => {
    navigate('/')
  }
  
  return <ResultPage runId={runId || ''} onBack={handleBack} />
}

function AppContent() {
  const navigate = useNavigate()

  const handleStartAudit = (runId: string) => {
    navigate(`/result/${runId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
      
      <Routes>
        <Route path="/" element={
          <HomePage onStartAudit={handleStartAudit} />
        } />
        <Route path="/result/:runId" element={<ResultPageWrapper />} />
        <Route path="/print/:runId" element={<PrintPage />} />
        <Route path="/print-result/:runId" element={<PrintResultPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App