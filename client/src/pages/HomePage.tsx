import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Zap, Shield, BarChart3, Sparkles, Clock, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

interface HomePageProps {
  onStartAudit: (runId: string) => void
}

interface AuditRun {
  runId: string
  url: string
  status: string
  startedAt: string
  totalScore?: number
  elapsedMs?: number
}

export default function HomePage({ onStartAudit }: HomePageProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [recentRuns, setRecentRuns] = useState<AuditRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    fetchRecentRuns()
  }, [])

  const fetchRecentRuns = async () => {
    try {
      const response = await axios.get('/api/audit/list?limit=5')
      setRecentRuns(response.data.runs || [])
    } catch (error) {
      console.error('Failed to fetch recent runs:', error)
    } finally {
      setLoadingRuns(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url) {
      toast.error('URL을 입력해주세요')
      return
    }

    // URL 유효성 검사
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      toast.error('올바른 URL을 입력해주세요')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await axios.post('/api/audit', {
        url: url.startsWith('http') ? url : `https://${url}`
      })
      
      toast.success('분석이 시작되었습니다!')
      onStartAudit(response.data.runId)
    } catch (error: any) {
      console.error('Failed to start audit:', error)
      toast.error(error.response?.data?.message || '분석 시작에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-8 h-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Mall Analysis POC</h1>
            </div>
            <span className="text-sm text-gray-500">자사몰 첫 페이지 자동 진단 시스템</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-8">
            <motion.h2 
              className="text-4xl font-bold text-gray-900 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              90초 안에 자사몰 분석 완료
            </motion.h2>
            <motion.p 
              className="text-lg text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              URL을 입력하면 10개 항목을 자동으로 평가하고 개선점을 제안합니다
            </motion.p>
          </div>

          {/* URL Input Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="card p-8"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                  분석할 사이트 URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    disabled={isLoading}
                  />
                  <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>분석 시작 중...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>분석 시작</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Recent Results */}
          {recentRuns.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-12"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 분석 결과</h3>
              <div className="space-y-3">
                {recentRuns.map(run => {
                  const scoreColor = run.totalScore 
                    ? run.totalScore >= 70 ? 'text-green-600' 
                    : run.totalScore >= 50 ? 'text-yellow-600' 
                    : 'text-red-600'
                    : 'text-gray-400'
                  
                  return (
                    <motion.div
                      key={run.runId}
                      whileHover={{ scale: 1.02 }}
                      className="card p-4 cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => onStartAudit(run.runId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {run.url.replace(/^https?:\/\//, '')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(run.startedAt).toLocaleDateString('ko-KR')}
                            </span>
                            {run.status === 'completed' && run.elapsedMs && (
                              <span className="text-xs text-gray-500">
                                {(run.elapsedMs / 1000).toFixed(1)}초
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {run.status === 'completed' && run.totalScore !== undefined ? (
                            <div className={`text-2xl font-bold ${scoreColor}`}>
                              {run.totalScore}
                            </div>
                          ) : run.status === 'processing' ? (
                            <div className="text-sm text-blue-600">처리중...</div>
                          ) : run.status === 'failed' ? (
                            <div className="text-sm text-red-600">실패</div>
                          ) : (
                            <div className="text-sm text-gray-400">대기중</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">빠른 분석</h3>
              <p className="text-sm text-gray-600 mt-1">90초 이내 완료</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">증거 기반</h3>
              <p className="text-sm text-gray-600 mt-1">스크린샷과 데이터 제공</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 text-purple-600 mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">AI 분석</h3>
              <p className="text-sm text-gray-600 mt-1">GPT-5 기반 평가</p>
            </div>
          </motion.div>

          {/* Supported Platforms */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-gray-500">
              지원 플랫폼: 카페24, 아임웹, 커스텀 사이트
            </p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}