import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useQuery } from 'react-query'
import axios from 'axios'
import ScoreCard from '../components/ScoreCard'
import ScoreChart from '../components/ScoreChart'
import LoadingScreen from '../components/LoadingScreen'

interface ResultPageProps {
  runId: string
  onBack: () => void
}

interface AuditResult {
  runId: string
  url: string
  status: string
  totalScore?: number
  checks?: any[]
  purchaseFlow?: any
  screenshots?: {
    main?: string
    actions?: string[]
  }
  elapsedMs?: number
  progress?: number
  position?: number
  error?: string
}

export default function ResultPage({ runId, onBack }: ResultPageProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)

  const { data, isLoading, error, refetch } = useQuery<AuditResult>(
    ['audit', runId],
    async () => {
      const response = await axios.get(`/api/audit/${runId}`)
      return response.data
    },
    {
      refetchInterval: (data) => {
        // 진행 중이면 2초마다 리페치
        if (data?.status === 'pending' || data?.status === 'processing') {
          return 2000
        }
        return false
      }
    }
  )

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const response = await axios.get(`/api/audit/${runId}/report.pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `mall-analysis-${runId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to download PDF:', error)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleDownloadZip = async () => {
    setDownloadingZip(true)
    try {
      const response = await axios.get(`/api/audit/${runId}/artifacts.zip`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `mall-analysis-${runId}-artifacts.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to download ZIP:', error)
    } finally {
      setDownloadingZip(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-excellent'
    if (score >= 70) return 'text-good'
    if (score >= 50) return 'text-needsWork'
    return 'text-critical'
  }

  const getScoreGrade = (score: number) => {
    if (score >= 85) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Needs Work'
    return 'Critical'
  }

  const getScoreBg = (score: number) => {
    if (score >= 85) return 'score-excellent'
    if (score >= 70) return 'score-good'
    if (score >= 50) return 'score-needs-work'
    return 'score-critical'
  }

  // 로딩 중이거나 처리 중
  if (isLoading || !data || data.status === 'pending' || data.status === 'processing') {
    return <LoadingScreen progress={data?.progress} status={data?.status} />
  }

  // 에러
  if (error || data.status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">분석 실패</h2>
          <p className="text-gray-600 mb-6">{data?.error || '알 수 없는 오류가 발생했습니다'}</p>
          <button onClick={onBack} className="btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const totalScore = data.totalScore || 0
  const checks = data.checks || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">분석 결과</h1>
                <p className="text-sm text-gray-500">{data.url}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn-secondary flex items-center space-x-2 py-2 px-4"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                onClick={handleDownloadZip}
                disabled={downloadingZip}
                className="btn-secondary flex items-center space-x-2 py-2 px-4"
              >
                <Download className="w-4 h-4" />
                <span>ZIP</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 mb-8"
        >
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${getScoreBg(totalScore)} mb-4`}>
              <span className={`text-5xl font-bold ${getScoreColor(totalScore)}`}>
                {totalScore}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {getScoreGrade(totalScore)}
            </h2>
            <p className="text-gray-600">
              총 {checks.length}개 항목 분석 완료 • {((data.elapsedMs || 0) / 1000).toFixed(1)}초 소요
            </p>
          </div>

          {/* Score Chart */}
          <div className="mt-8">
            <ScoreChart checks={checks} />
          </div>
        </motion.div>

        {/* Screenshots Section */}
        {data.screenshots && (data.screenshots.main || data.screenshots.actions?.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 mb-8"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">페이지 스크린샷</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.screenshots.main && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">메인 페이지</h4>
                  <img 
                    src={data.screenshots.main} 
                    alt="Main page screenshot" 
                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                  />
                </div>
              )}
              {data.screenshots.actions?.map((screenshot, index) => (
                <div key={index}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">액션 {index + 1}</h4>
                  <img 
                    src={screenshot} 
                    alt={`Action ${index + 1} screenshot`} 
                    className="w-full rounded-lg border border-gray-200 shadow-sm"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Purchase Flow */}
        {data.purchaseFlow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 mb-8"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">구매 플로우</h3>
            <div className="flex items-center justify-between">
              {['home', 'pdp', 'cart', 'checkout'].map((step, index) => {
                const completed = data.purchaseFlow.steps.some((s: any) => s.name === step)
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {completed ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      {step === 'home' && '홈'}
                      {step === 'pdp' && '상품'}
                      {step === 'cart' && '장바구니'}
                      {step === 'checkout' && '결제'}
                    </span>
                    {index < 3 && (
                      <div className={`w-12 h-0.5 mx-3 ${
                        completed ? 'bg-green-300' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {checks.map((check, index) => (
            <motion.div
              key={check.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <ScoreCard check={check} />
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}