import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { motion } from 'framer-motion'
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

export default function PrintPage() {
  const { runId } = useParams<{ runId: string }>()
  const [data, setData] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (runId) {
      axios.get(`/api/audit/${runId}`)
        .then(response => {
          setData(response.data)
          setLoading(false)
          // 데이터 로드 후 자동으로 프린트 다이얼로그 표시 (옵션)
          // setTimeout(() => window.print(), 1000)
        })
        .catch(err => {
          console.error('Failed to load audit data:', err)
          setLoading(false)
        })
    }
  }, [runId])

  if (loading) {
    return (
      <div className="print-page loading">
        <p>Loading report data...</p>
      </div>
    )
  }

  if (!data || !data.totalScore) {
    return (
      <div className="print-page error">
        <p>No data available for this report</p>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return '#10b981'
    if (score >= 70) return '#3b82f6'
    if (score >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const getScoreGrade = (score: number) => {
    if (score >= 85) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 50) return 'Needs Work'
    return 'Critical'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="print-page">
      {/* 페이지 1: 표지 */}
      <div className="page cover-page">
        <div className="cover-content">
          <h1 className="cover-title">자사몰 첫 페이지 분석 리포트</h1>
          <div className="cover-url">{data.url}</div>
          <div className="cover-date">{formatDate(data.startedAt)}</div>
          
          <div className="cover-score">
            <div className="score-circle" style={{ borderColor: getScoreColor(data.totalScore) }}>
              <div className="score-value">{data.totalScore}</div>
              <div className="score-label">종합 점수</div>
            </div>
            <div className="score-grade" style={{ color: getScoreColor(data.totalScore) }}>
              {getScoreGrade(data.totalScore)}
            </div>
          </div>

          {data.expertSummary && (
            <div className="cover-grade">
              <span className="grade-badge">{data.expertSummary.grade}등급</span>
            </div>
          )}
        </div>
      </div>

      {/* 페이지 2: 종합 요약 */}
      {data.expertSummary && (
        <div className="page summary-page">
          <h2 className="page-title">종합 분석 요약</h2>
          
          <div className="summary-headline">
            <h3>{data.expertSummary.headline}</h3>
          </div>

          <div className="summary-sections">
            <div className="summary-section">
              <h4>✅ 강점 ({data.expertSummary.strengths.length})</h4>
              <ul>
                {data.expertSummary.strengths.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="summary-section">
              <h4>⚠️ 개선 필요 ({data.expertSummary.weaknesses.length})</h4>
              <ul>
                {data.expertSummary.weaknesses.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="summary-section">
              <h4>🎯 우선순위 ({data.expertSummary.priorities.length})</h4>
              <ol>
                {data.expertSummary.priorities.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 페이지 3-4: 상세 점수 */}
      {data.checks && (
        <div className="page scores-page">
          <h2 className="page-title">체크리스트 상세 점수</h2>
          
          <div className="scores-chart">
            <ScoreChart checks={data.checks} />
          </div>

          <div className="scores-grid">
            {data.checks.map((check, idx) => (
              <div key={idx} className="score-item">
                <div className="score-item-header">
                  <span className="score-item-name">{check.nameKo}</span>
                  <span className="score-item-value" style={{ color: getScoreColor(check.score) }}>
                    {check.score}점
                  </span>
                </div>
                {check.insights && check.insights.length > 0 && (
                  <div className="score-item-insights">
                    {check.insights.slice(0, 2).map((insight, i) => (
                      <p key={i}>• {insight}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 페이지 5: 구매 플로우 */}
      {data.purchaseFlow && (
        <div className="page purchase-flow-page">
          <h2 className="page-title">구매 플로우 분석</h2>
          
          <div className="flow-steps">
            {['home', 'category', 'product', 'cart', 'checkout'].map(step => {
              const stepData = data.purchaseFlow[step]
              if (!stepData) return null
              
              return (
                <div key={step} className="flow-step">
                  <h3>{step.charAt(0).toUpperCase() + step.slice(1)}</h3>
                  <div className={`flow-status ${stepData.exists ? 'exists' : 'missing'}`}>
                    {stepData.exists ? '✓ 확인됨' : '✗ 미확인'}
                  </div>
                  {stepData.url && (
                    <div className="flow-url">{stepData.url}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 페이지 6: 스크린샷 */}
      {data.screenshots?.main && (
        <div className="page screenshot-page">
          <h2 className="page-title">메인 페이지 스크린샷</h2>
          <div className="screenshot-container">
            <img 
              src={data.screenshots.main} 
              alt="Main page screenshot"
              className="main-screenshot"
            />
          </div>
        </div>
      )}

      {/* 푸터 정보 */}
      <div className="print-footer">
        <div className="footer-text">
          Mall Analysis POC - {formatDate(data.startedAt)} - Page <span className="page-number"></span>
        </div>
      </div>
    </div>
  )
}