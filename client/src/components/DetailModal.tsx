import { X, Info, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  describeSpeed, 
  describeEvidence, 
  describeGrade,
  translateMetricName 
} from '../../../src/utils/natural-language'

interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  check: {
    id: string
    score: number
    metrics?: any
    evidence?: any
    insights?: string[]
  }
}

export default function DetailModal({ isOpen, onClose, check }: DetailModalProps) {
  if (!isOpen || !check) return null

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

  const getScoreIcon = (score: number) => {
    if (score >= 8) return <CheckCircle className="w-6 h-6 text-green-500" />
    if (score >= 5) return <AlertCircle className="w-6 h-6 text-yellow-500" />
    return <XCircle className="w-6 h-6 text-red-500" />
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center space-x-3">
                  {getScoreIcon(check.score)}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {getCategoryName(check.id)} 상세 분석
                    </h2>
                    <p className="text-sm text-gray-600">
                      {describeGrade(check.score)} 등급
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Score */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <span className="mr-2">📊</span> 점수 분석
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`text-4xl font-bold ${getScoreColor(check.score)}`}>
                        {check.score}/10
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">등급</div>
                        <div className="text-lg font-semibold">{describeGrade(check.score)}</div>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          check.score >= 8 ? 'bg-green-500' :
                          check.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${check.score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics - 속도 카테고리 전용 */}
                {check.id === 'speed' && check.metrics && Object.keys(check.metrics).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <span className="mr-2">⚡</span> 성능 지표
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(check.metrics)
                        .filter(([_, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => (
                          <div key={key} className="bg-blue-50 rounded-lg p-4">
                            <div className="text-sm text-gray-600 mb-1">
                              {translateMetricName(key)}
                            </div>
                            <div className="font-semibold text-gray-900">
                              {check.id === 'speed' 
                                ? describeSpeed(value as number, key)
                                : value}
                            </div>
                            {key === 'LCP' && (
                              <div className="text-xs text-gray-500 mt-1">
                                페이지 주요 콘텐츠가 보이는 시간
                              </div>
                            )}
                            {key === 'CLS' && (
                              <div className="text-xs text-gray-500 mt-1">
                                레이아웃이 얼마나 안정적인지
                              </div>
                            )}
                            {key === 'TBT' && (
                              <div className="text-xs text-gray-500 mt-1">
                                사용자 입력 반응 속도
                              </div>
                            )}
                          </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence - 자연어로 변환 */}
                {check.evidence && Object.keys(check.evidence).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <span className="mr-2">🔍</span> 분석 결과
                    </h3>
                    <div className="space-y-3">
                      {describeEvidence(check.evidence).map((description, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="mt-1">
                            {description.includes('✅') ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : description.includes('❌') ? (
                              <XCircle className="w-5 h-5 text-red-500" />
                            ) : description.includes('⚠️') ? (
                              <AlertCircle className="w-5 h-5 text-yellow-500" />
                            ) : (
                              <Info className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                          <p className="text-gray-700 flex-1">{description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights */}
                {check.insights && check.insights.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <span className="mr-2">💡</span> 개선 제안
                    </h3>
                    <div className="bg-amber-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {check.insights.map((insight, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <span className="text-amber-600 mt-1">•</span>
                            <p className="text-gray-800">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 기술적 상세 정보 (토글 가능) */}
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    🔧 개발자용 상세 정보 보기
                  </summary>
                  <div className="mt-3 p-4 bg-gray-100 rounded-lg">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify({ metrics: check.metrics, evidence: check.evidence }, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}