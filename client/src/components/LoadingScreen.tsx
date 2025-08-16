import { motion } from 'framer-motion'

interface LoadingScreenProps {
  progress?: number
  status?: string
}

export default function LoadingScreen({ progress = 0, status = 'pending' }: LoadingScreenProps) {
  const steps = [
    { id: 'scraping', label: '웹 페이지 수집', range: [0, 30] },
    { id: 'performance', label: '성능 측정', range: [30, 50] },
    { id: 'analysis', label: 'AI 분석', range: [50, 70] },
    { id: 'scoring', label: '점수 계산', range: [70, 80] },
    { id: 'report', label: '리포트 생성', range: [80, 100] }
  ]

  const getCurrentStep = () => {
    return steps.find(step => progress >= step.range[0] && progress < step.range[1]) || steps[0]
  }

  const currentStep = getCurrentStep()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-purple-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
      >
        <div className="text-center">
          {/* Spinner */}
          <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-24 h-24 rounded-full border-4 border-primary-200 border-t-primary-600"
            />
          </div>

          {/* Status Text */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            분석 진행 중
          </h2>
          <p className="text-gray-600 mb-6">
            {currentStep.label}...
          </p>

          {/* Progress Bar */}
          <div className="relative">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
              />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {progress}% 완료
            </div>
          </div>

          {/* Steps */}
          <div className="mt-8 space-y-3">
            {steps.map((step) => {
              const isCompleted = progress >= step.range[1]
              const isCurrent = step.id === currentStep.id
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center space-x-3 transition-all ${
                    isCompleted ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500' 
                      : isCurrent 
                        ? 'border-primary-600 bg-white' 
                        : 'border-gray-300 bg-white'
                  }`}>
                    {isCompleted && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {isCurrent && (
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className={`text-sm ${
                    isCompleted || isCurrent ? 'text-gray-900 font-medium' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Tip */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 매출 증가를 위한 최적화 방안을 찾고 있습니다...
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}