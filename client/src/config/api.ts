import axios from 'axios'

// API URL 환경 변수 설정
const API_URL = import.meta.env.VITE_API_URL || '/api'

// axios 인스턴스 생성
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 90000, // 90초 타임아웃
  headers: {
    'Content-Type': 'application/json'
  }
})

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // 개발 환경에서 로깅
    if (import.meta.env.DEV) {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    }
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// 응답 인터셉터
apiClient.interceptors.response.use(
  (response) => {
    // 개발 환경에서 로깅
    if (import.meta.env.DEV) {
      console.log(`✅ API Response: ${response.config.url}`, response.data)
    }
    return response
  },
  (error) => {
    // 에러 처리
    if (error.response) {
      // 서버가 응답을 반환한 경우
      console.error(`❌ API Error [${error.response.status}]:`, error.response.data)
      
      // 특정 상태 코드에 대한 처리
      switch (error.response.status) {
        case 401:
          // 인증 실패
          console.error('Authentication failed')
          break
        case 404:
          console.error('Resource not found')
          break
        case 500:
          console.error('Server error')
          break
      }
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못한 경우
      console.error('❌ No response from server:', error.request)
    } else {
      // 요청 설정 중 에러가 발생한 경우
      console.error('❌ Request setup error:', error.message)
    }
    
    return Promise.reject(error)
  }
)

export default apiClient