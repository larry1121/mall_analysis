import { useState } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import HomePage from './pages/HomePage'
import ResultPage from './pages/ResultPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function App() {
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)

  return (
    <QueryClientProvider client={queryClient}>
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
        
        <AnimatePresence mode="wait">
          {!currentRunId ? (
            <HomePage key="home" onStartAudit={setCurrentRunId} />
          ) : (
            <ResultPage 
              key="result" 
              runId={currentRunId} 
              onBack={() => setCurrentRunId(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </QueryClientProvider>
  )
}

export default App