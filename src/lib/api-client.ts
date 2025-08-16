import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * API 응답 타입
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * API 클라이언트 설정
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

/**
 * API 클라이언트 클래스
 * 모든 HTTP 요청을 중앙에서 관리
 */
export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      }
    });

    this.setupInterceptors();
  }

  /**
   * 요청/응답 인터셉터 설정
   */
  private setupInterceptors(): void {
    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config: any) => {
        // 요청 로깅
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error: any) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response: any) => {
        // 응답 로깅
        if (process.env.NODE_ENV === 'development') {
          console.log(`[API Response] ${response.status} ${response.config.url}`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: number };
        
        // 재시도 로직
        if (error.code === 'ECONNABORTED' || error.response?.status === 503) {
          originalRequest._retry = (originalRequest._retry || 0) + 1;
          
          if (originalRequest._retry <= (this.config.maxRetries || 3)) {
            const delay = this.config.retryDelay || 1000;
            await this.sleep(delay * originalRequest._retry);
            return this.client.request(originalRequest);
          }
        }

        // 에러 로깅
        console.error('[API Response Error]', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });

        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * GET 요청
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(url, config);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST 요청
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * PUT 요청
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<T>(url, data, config);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * DELETE 요청
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<T>(url, config);
      return this.formatResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 응답 포맷팅
   */
  private formatResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      success: true,
      data: response.data
    };
  }

  /**
   * 에러 포맷팅
   */
  private formatError(error: AxiosError): any {
    if (error.response) {
      // 서버 응답 에러
      return {
        code: `HTTP_${error.response.status}`,
        message: error.response.statusText,
        status: error.response.status,
        data: error.response.data
      };
    } else if (error.request) {
      // 네트워크 에러
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        details: error.message
      };
    } else {
      // 기타 에러
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * 에러 핸들링
   */
  private handleError(error: any): ApiResponse {
    return {
      success: false,
      error: error
    };
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 인스턴스 반환
   */
  getInstance(): AxiosInstance {
    return this.client;
  }
}

/**
 * 싱글톤 인스턴스
 */
let apiClientInstance: ApiClient | null = null;

/**
 * API 클라이언트 초기화
 */
export function initializeApiClient(config: ApiClientConfig): ApiClient {
  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

/**
 * API 클라이언트 가져오기
 */
export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    throw new Error('API Client not initialized. Call initializeApiClient first.');
  }
  return apiClientInstance;
}