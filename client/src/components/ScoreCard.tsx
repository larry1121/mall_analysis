import { AlertCircle, TrendingUp, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import DetailModal from './DetailModal'

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
  const [showDetail, setShowDetail] = useState(false)
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

        {/* Metrics */}
        {check.metrics && Object.keys(check.metrics).length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs font-medium text-gray-500 mb-2">측정값</div>
            <div className="space-y-1">
              {Object.entries(check.metrics).slice(0, 3).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className="font-medium text-gray-900">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence */}
        {check.evidence && Object.keys(check.evidence).length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-xs font-medium text-blue-700 mb-2">근거 데이터</div>
            <div className="space-y-1">
              {Object.entries(check.evidence).slice(0, 3).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-gray-600">{key}:</span>
                  <span className="ml-2 text-gray-900">
                    {typeof value === 'object' 
                      ? JSON.stringify(value, null, 2).substring(0, 50) + '...'
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {check.insights && check.insights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-1 text-xs font-medium text-gray-500">
              <TrendingUp className="w-3 h-3" />
              <span>개선 제안</span>
            </div>
            {check.insights.slice(0, 2).map((insight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
              </div>
            ))}
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

        {/* View Details Button */}
        <button
          onClick={() => setShowDetail(true)}
          className="mt-4 w-full flex items-center justify-center space-x-2 py-2 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700"
        >
          <span>상세보기</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Detail Modal */}
      <DetailModal 
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        check={check}
      />
    </div>
  )
}