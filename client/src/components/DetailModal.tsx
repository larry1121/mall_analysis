import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  {getCategoryName(check.id)} 상세 분석
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {/* Score */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">점수</h3>
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl font-bold text-primary">
                      {check.score}/10
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full flex-1">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${check.score * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                {check.metrics && Object.keys(check.metrics).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">측정값</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(check.metrics).map(([key, value]) => (
                          <div key={key}>
                            <div className="text-sm text-gray-600">{key}</div>
                            <div className="font-medium text-gray-900">
                              {typeof value === 'number' 
                                ? value.toFixed(2) 
                                : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence */}
                {check.evidence && Object.keys(check.evidence).length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">근거 데이터</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {JSON.stringify(check.evidence, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Insights */}
                {check.insights && check.insights.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">개선 제안</h3>
                    <div className="space-y-2">
                      {check.insights.map((insight, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="text-primary mt-1">•</span>
                          <p className="text-gray-700">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}