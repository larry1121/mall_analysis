import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useQuery } from 'react-query'
import apiClient from '../config/api'
import ScoreCard from '../components/ScoreCard'
import ScoreChart from '../components/ScoreChart'
import LoadingScreen from '../components/LoadingScreen'
import ScreenshotGallery from '../components/ScreenshotGallery'

interface ResultPageProps {
  runId: string
  onBack: () => void
}

interface ExpertSummary {
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  headline: string
  strengths: string[]
  weaknesses: string[]
  priorities: string[]
}

interface AuditResult {
  runId: string
  url: string
  status: string
  totalScore?: number
  checks?: any[]
  expertSummary?: ExpertSummary
  purchaseFlow?: any
  screenshots?: {
    main?: string
    actions?: string[]
  }
  elapsedMs?: number
  progress?: number
  position?: number
  error?: string
  platform?: string
}

export default function ResultPage({ runId, onBack }: ResultPageProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [data, setData] = useState<AuditResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    let interval: NodeJS.Timeout | null = null
    
    // 먼저 초기 데이터 로드
    apiClient.get(`/audit/${runId}`)
      .then(response => {
        if (response.data && Object.keys(response.data).length > 0) {
          setData(response.data)
          setIsLoading(false)
          
          // SSE 연결 설정 - 진행 중인 경우에만
          if (response.data.status === 'pending' || response.data.status === 'processing') {
            eventSource = new EventSource(`/api/audit/${runId}/stream`)
            
            eventSource.onmessage = (event) => {
              try {
                const result = JSON.parse(event.data)
                setData(result)
                
                // 완료 또는 실패 시 연결 종료
                if (result.status === 'completed' || result.status === 'failed') {
                  eventSource?.close()
                }
              } catch (err) {
                console.error('Failed to parse SSE data:', err)
              }
            }

            eventSource.onerror = (err) => {
              console.error('SSE connection error:', err)
              eventSource?.close()
              
              // 폴백: 일반 API로 주기적 체크
              interval = setInterval(() => {
                apiClient.get(`/audit/${runId}`)
                  .then(res => {
                    if (res.data) {
                      setData(res.data)
                      if (res.data.status === 'completed' || res.data.status === 'failed') {
                        if (interval) clearInterval(interval)
                      }
                    }
                  })
                  .catch(() => {
                    if (interval) clearInterval(interval)
                  })
              }, 3000)
            }
          }
        } else {
          setIsLoading(false)
          setError(new Error('Result not found'))
        }
      })
      .catch(err => {
        console.error('Failed to load initial data:', err)
        setError(err)
        setIsLoading(false)
      })
    
    // 클린업 함수
    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [runId])

  const refetch = () => {
    setIsLoading(true)
    apiClient.get(`/audit/${runId}`)
      .then(response => {
        setData(response.data)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err)
        setIsLoading(false)
      })
  }

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const response = await apiClient.get(`/audit/${runId}/report.pdf`, {
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
      const response = await apiClient.get(`/audit/${runId}/artifacts.zip`, {
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

  // 로딩 중
  if (isLoading && !error) {
    return <LoadingScreen progress={0} status="pending" />
  }

  // 에러가 발생했거나 데이터를 찾을 수 없는 경우
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">분석 결과를 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-6">
            요청하신 분석 결과가 존재하지 않거나 만료되었습니다.<br />
            새로운 분석을 시작해주세요.
          </p>
          <button onClick={onBack} className="btn-primary">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // 처리 중 (pending 또는 processing)
  if (data.status === 'pending' || data.status === 'processing') {
    return <LoadingScreen progress={data?.progress || 0} status={data?.status} />
  }

  // 분석 실패
  if (data.status === 'failed') {
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

  // 완료되었지만 데이터가 없는 경우 처리
  if (data.status === 'completed' && (!data.totalScore && !data.checks)) {
    return <LoadingScreen progress={90} status="processing" />
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
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500">{data.url}</p>
                  {data.platform && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      data.platform === 'cafe24' ? 'bg-orange-100 text-orange-700' :
                      data.platform === 'imweb' ? 'bg-blue-100 text-blue-700' :
                      data.platform === 'shopify' ? 'bg-green-100 text-green-700' :
                      data.platform === 'woocommerce' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {data.platform === 'cafe24' ? 'Cafe24' :
                       data.platform === 'imweb' ? 'IMWEB' :
                       data.platform === 'shopify' ? 'Shopify' :
                       data.platform === 'woocommerce' ? 'WooCommerce' :
                       data.platform === 'unknown' ? '커스텀' :
                       data.platform || '분석중'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => window.open(`/print-result/${runId}`, '_blank')}
                className="btn-secondary flex items-center space-x-2 py-2 px-4"
              >
                <Download className="w-4 h-4" />
                <span>PDF 미리보기</span>
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn-secondary flex items-center space-x-2 py-2 px-4"
              >
                <Download className="w-4 h-4" />
                <span>PDF 다운로드</span>
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
        {/* Expert Summary */}
        {data.expertSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-indigo-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">시니어 전문가 총평</h2>
                <p className="text-lg text-gray-700">{data.expertSummary.headline}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                data.expertSummary.grade === 'S' ? 'bg-purple-100 text-purple-700' :
                data.expertSummary.grade === 'A' ? 'bg-green-100 text-green-700' :
                data.expertSummary.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                data.expertSummary.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                data.expertSummary.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                Grade {data.expertSummary.grade}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div>
                <h3 className="font-semibold text-green-700 mb-2">💪 강점</h3>
                <ul className="space-y-1">
                  {data.expertSummary.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-red-700 mb-2">⚠️ 개선점</h3>
                <ul className="space-y-1">
                  {data.expertSummary.weaknesses.map((weakness, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <span className="text-red-500 mr-2">•</span>
                      {weakness}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-indigo-700 mb-2">🎯 우선순위</h3>
                <ul className="space-y-1">
                  {data.expertSummary.priorities.map((priority, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start">
                      <span className="text-indigo-500 mr-2">{i + 1}.</span>
                      {priority}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

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

        {/* Screenshots Gallery - Current Analysis Only */}
        {data.screenshots?.main && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6 mb-8"
          >
            <ScreenshotGallery runId={runId} screenshots={data.screenshots} />
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