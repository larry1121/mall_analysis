/**
 * API 관련 타입 정의
 */

/**
 * API 요청 기본 타입
 */
export interface ApiRequest {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

/**
 * API 응답 기본 타입
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * API 에러 타입
 */
export interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: any;
  timestamp?: string;
}

/**
 * API 메타데이터
 */
export interface ApiMeta {
  timestamp: string;
  duration?: number;
  requestId?: string;
  version?: string;
}

/**
 * 페이지네이션 요청
 */
export interface PaginationRequest {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * 페이지네이션 응답
 */
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 필터 요청
 */
export interface FilterRequest {
  [key: string]: any;
}

/**
 * 정렬 요청
 */
export interface SortRequest {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * 배치 작업 요청
 */
export interface BatchRequest<T> {
  items: T[];
  options?: {
    parallel?: boolean;
    stopOnError?: boolean;
  };
}

/**
 * 배치 작업 응답
 */
export interface BatchResponse<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: ApiError;
  }>;
  total: number;
  successCount: number;
  failureCount: number;
}

/**
 * 스트리밍 응답 타입
 */
export interface StreamResponse<T> {
  type: 'data' | 'error' | 'complete';
  data?: T;
  error?: ApiError;
  progress?: number;
  message?: string;
}

/**
 * 웹소켓 메시지 타입
 */
export interface WebSocketMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: string;
}

/**
 * SSE 이벤트 타입
 */
export interface SSEEvent<T = any> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
}