import { AlertCircle, TrendingUp, CheckCircle, XCircle, Info, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { 
  describeSpeed, 
  describeEvidence, 
  describeGrade,
  translateMetricName 
} from '../utils/natural-language'

interface ScoreCardProps {
  check: {
    id: string
    score: number
    metrics?: any
    evidence?: any
    insights?: string[]
  }
}

export default function ScoreCard({ check }: ScoreCardProps) {
  const [showImage, setShowImage] = useState<string | null>(null)
  
  const getCategoryName = (id: string) => {
    const names: Record<string, string> = {
      speed: '페이지 속도',
      firstView: '퍼스트뷰',
      bi: '브랜드 아이덴티티',
      navigation: '내비게이션',
      uspPromo: 'USP/프로모션',
      visuals: '비주얼',
      trust: '신뢰 요소',
      mobile: '모바일 최적화',
      purchaseFlow: '구매 플로우',
      seoAnalytics: 'SEO/분석'
    }
    return names[id] || id
  }

  const getCategoryIcon = (id: string) => {
    const icons: Record<string, string> = {
      speed: '⚡',
      firstView: '👁️',
      bi: '🎨',
      navigation: '🧭',
      uspPromo: '🎯',
      visuals: '🖼️',
      trust: '🛡️',
      mobile: '📱',
      purchaseFlow: '🛒',
      seoAnalytics: '📊'
    }
    return icons[id] || '📝'
  }

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return 'text-excellent border-excellent bg-green-50'
    if (score >= 7) return 'text-good border-good bg-blue-50'
    if (score >= 5) return 'text-needsWork border-needsWork bg-yellow-50'
    return 'text-critical border-critical bg-red-50'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 8.5) return 'bg-excellent'
    if (score >= 7) return 'bg-good'
    if (score >= 5) return 'bg-needsWork'
    return 'bg-critical'
  }

  return (
    <div className="card h-full">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getCategoryIcon(check.id)}</span>
            <div>
              <h3 className="font-semibold text-gray-900">
                {getCategoryName(check.id)}
              </h3>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full border-2 font-bold ${getScoreColor(check.score)}`}>
            {check.score}/10
          </div>
        </div>

        {/* Score Bar */}
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getScoreBarColor(check.score)} transition-all duration-500`}
              style={{ width: `${check.score * 10}%` }}
            />
          </div>
        </div>

        {/* Performance Metrics - Speed 카테고리 전용 */}
        {check.id === 'speed' && check.metrics && Object.keys(check.metrics).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">⚡ 성능 지표</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(check.metrics)
                .filter(([_, value]) => value !== null && value !== undefined)
                .map(([key, value]) => (
                  <div key={key} className="bg-blue-50 rounded-lg p-2">
                    <div className="text-xs text-gray-600">
                      {translateMetricName(key)}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {describeSpeed(value as number, key)}
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Results - 자연어로 변환 */}
        {check.evidence && Object.keys(check.evidence).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">🔍 분석 결과</div>
            <div className="space-y-2">
              {describeEvidence(check.evidence).slice(0, 3).map((description, index) => {
                // Evidence에서 관련 이미지/스크린샷 찾기
                const evidenceKey = Object.keys(check.evidence).find(key => 
                  description.toLowerCase().includes(key.toLowerCase())
                )
                const evidenceData = evidenceKey ? check.evidence[evidenceKey] : null
                const hasScreenshot = evidenceData?.screenshot || evidenceData?.image
                
                return (
                  <div key={index} className="flex items-start space-x-2">
                    <div className="mt-0.5">
                      {description.includes('✅') ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : description.includes('❌') ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : description.includes('⚠️') ? (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{description.replace(/[✅❌⚠️]/g, '').trim()}</p>
                      {hasScreenshot && (
                        <button
                          onClick={() => setShowImage(hasScreenshot)}
                          className="mt-1 inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>이미지 보기</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Evidence Screenshots if available */}
            {check.evidence.screenshots && Array.isArray(check.evidence.screenshots) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {check.evidence.screenshots.slice(0, 3).map((screenshot: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setShowImage(screenshot)}
                    className="relative w-20 h-20 rounded border-2 border-gray-200 overflow-hidden hover:border-blue-500 transition-colors"
                  >
                    <img 
                      src={screenshot.startsWith('data:') ? screenshot : `/api/screenshots/${screenshot}`}
                      alt={`Evidence ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Improvement Suggestions */}
        {check.insights && check.insights.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-1 text-xs font-medium text-gray-500 mb-2">
              <TrendingUp className="w-3 h-3" />
              <span>💡 개선 제안</span>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="space-y-1">
                {check.insights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <p className="text-sm text-gray-800">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No Issues */}
        {(!check.insights || check.insights.length === 0) && check.score >= 8.5 && (
          <div className="flex items-center space-x-2 text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">우수한 수준입니다</span>
          </div>
        )}

        {/* Grade Information */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">등급</span>
            <span className="font-medium text-gray-900">{describeGrade(check.score)}</span>
          </div>
        </div>

        {/* 기술적 상세 정보 (토글 가능) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            🔧 개발자용 상세 정보 보기
          </summary>
          <div className="mt-3 p-3 bg-gray-100 rounded-lg">
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
{JSON.stringify({ 
  metrics: check.metrics, 
  evidence: check.evidence,
  insights: check.insights 
}, null, 2)}
            </pre>
          </div>
        </details>
      </div>

      {/* Image Modal */}
      {showImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setShowImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={showImage.startsWith('data:') ? showImage : `/api/screenshots/${showImage}`}
              alt="Evidence"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setShowImage(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
            >
              <XCircle className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}