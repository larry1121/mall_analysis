import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from 'lucide-react'
import ScoreCard from '../components/ScoreCard'
import ScoreChart from '../components/ScoreChart'
import ScreenshotGallery from '../components/ScreenshotGallery'

interface AuditResult {
  runId: string
  url: string
  status: string
  totalScore?: number
  checks?: any[]
  expertSummary?: {
    grade: string
    headline: string
    strengths: string[]
    weaknesses: string[]
    priorities: string[]
  }
  purchaseFlow?: any
  screenshots?: {
    main?: string
    actions?: string[]
  }
  elapsedMs?: number
  startedAt?: string
}

export default function PrintResultPage() {
  const { runId } = useParams<{ runId: string }>()
  const [data, setData] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (runId) {
      axios.get(`/api/audit/${runId}`)
        .then(response => {
          setData(response.data)
          setLoading(false)
          // PDF 생성을 위한 시그널
          if (window.location.search.includes('pdf=true')) {
            setTimeout(() => {
              window.READY_TO_PRINT = true;
            }, 2000);
          }
        })
        .catch(err => {
          console.error('Failed to load audit data:', err)
          setLoading(false)
        })
    }
  }, [runId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading report data...</p>
      </div>
    )
  }

  if (!data || !data.totalScore) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No data available for this report</p>
      </div>
    )
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

  const totalScore = data.totalScore || 0
  const checks = data.checks || []

  return (
    <div className="min-h-screen bg-white print-result-page">
      {/* Header - 인쇄 시 간소화 */}
      <header className="bg-white border-b border-gray-200 no-print-on-pdf">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">분석 결과</h1>
              <p className="text-sm text-gray-500">{data.url}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - ResultPage와 동일한 레이아웃 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Expert Summary */}
        {data.expertSummary && (
          <div className="card p-6 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-indigo-200 page-break-after">
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
          </div>
        )}

        {/* Score Hero */}
        <div className="card p-8 mb-8 page-break-after">
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
        </div>

        {/* Screenshots Gallery - 인쇄 시 첫 번째 스크린샷만 */}
        {data.screenshots?.main && (
          <div className="card p-6 mb-8 page-break-after print-screenshot">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">메인 페이지 스크린샷</h3>
            <div className="screenshot-for-print">
              <img 
                src={data.screenshots.main} 
                alt="Main page screenshot"
                className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
                style={{ maxHeight: '600px', objectFit: 'contain' }}
              />
            </div>
            <div className="no-print">
              <ScreenshotGallery runId={runId!} screenshots={data.screenshots} />
            </div>
          </div>
        )}

        {/* Purchase Flow */}
        {data.purchaseFlow && (
          <div className="card p-6 mb-8 page-break-after">
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
          </div>
        )}

        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid">
          {checks.map((check, index) => (
            <div
              key={check.id}
              className="print-score-card"
            >
              <ScoreCard check={check} />
            </div>
          ))}
        </div>
      </main>

      {/* 인쇄용 스타일 */}
      <style jsx>{`
        @media print {
          .print-result-page {
            background: white !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .no-print-on-pdf {
            display: none !important;
          }
          
          .page-break-after {
            page-break-after: always;
          }
          
          .print-grid {
            display: block !important;
          }
          
          .print-score-card {
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
          
          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
          }
          
          .print-screenshot img {
            max-height: 500px !important;
          }
        }
      `}</style>
    </div>
  )
}