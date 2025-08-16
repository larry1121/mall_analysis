import { ApiClient, initializeApiClient, getApiClient } from '../lib/api-client.js';
import { AuditRequest, AuditResult, AuditRun } from '../types/index.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

/**
 * API 서비스 클래스
 * 모든 API 호출을 관리하는 서비스 레이어
 */
export class ApiService {
  private client: ApiClient;

  constructor(baseURL?: string) {
    try {
      this.client = getApiClient();
    } catch {
      // API 클라이언트가 초기화되지 않은 경우
      this.client = initializeApiClient({
        baseURL: baseURL || process.env.API_URL || 'http://localhost:3000',
        timeout: parseInt(process.env.API_TIMEOUT || '90000'),
        maxRetries: parseInt(process.env.API_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.API_RETRY_DELAY || '1000')
      });
    }
  }

  /**
   * 새로운 감사 시작
   */
  async startAudit(request: AuditRequest): Promise<AuditRun> {
    // URL 유효성 검증
    try {
      new URL(request.url);
    } catch {
      throw new ValidationError('Invalid URL provided');
    }

    const response = await this.client.post<AuditRun>('/api/audit', request);
    
    if (!response.success) {
      throw new ValidationError('Failed to start audit', response.error);
    }

    return response.data!;
  }

  /**
   * 감사 상태 조회
   */
  async getAuditStatus(runId: string): Promise<AuditResult> {
    if (!runId) {
      throw new ValidationError('Run ID is required');
    }

    const response = await this.client.get<AuditResult>(`/api/audit/${runId}`);
    
    if (!response.success) {
      if ((response.error as any)?.status === 404) {
        throw new NotFoundError('Audit run', runId);
      }
      throw new Error(response.error?.message || 'Failed to get audit status');
    }

    return response.data!;
  }

  /**
   * 전체 감사 결과 조회
   */
  async getAuditResult(runId: string): Promise<AuditResult> {
    const result = await this.getAuditStatus(runId);
    
    if (result.status !== 'completed') {
      throw new ValidationError(`Audit is not completed yet. Current status: ${result.status}`);
    }

    return result;
  }

  /**
   * PDF 리포트 다운로드
   */
  async downloadPDF(runId: string): Promise<Blob> {
    if (!runId) {
      throw new ValidationError('Run ID is required');
    }

    const instance = this.client.getInstance();
    
    try {
      const response = await instance.get(`/api/audit/${runId}/download/pdf`, {
        responseType: 'blob'
      });
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new NotFoundError('PDF report', runId);
      }
      throw error;
    }
  }

  /**
   * 감사 목록 조회
   */
  async listAudits(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{
    runs: AuditRun[];
    total: number;
    hasMore: boolean;
  }> {
    const response = await this.client.get('/api/audit/list', { params });
    
    if (!response.success) {
      throw new Error('Failed to list audits');
    }

    return response.data!;
  }

  /**
   * 감사 삭제
   */
  async deleteAudit(runId: string): Promise<void> {
    if (!runId) {
      throw new ValidationError('Run ID is required');
    }

    const response = await this.client.delete(`/api/audit/${runId}`);
    
    if (!response.success) {
      if ((response.error as any)?.status === 404) {
        throw new NotFoundError('Audit run', runId);
      }
      throw new Error('Failed to delete audit');
    }
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{
    status: string;
    services: Record<string, boolean>;
  }> {
    const response = await this.client.get('/api/health');
    
    if (!response.success) {
      throw new Error('Health check failed');
    }

    return response.data!;
  }

  /**
   * SSE 스트림 연결
   */
  connectToStream(runId: string, onMessage: (data: any) => void, onError?: (error: any) => void): EventSource {
    const baseURL = this.client.getInstance().defaults.baseURL;
    const eventSource = new EventSource(`${baseURL}/api/audit/${runId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }
      eventSource.close();
    };

    return eventSource;
  }
}

/**
 * 싱글톤 인스턴스
 */
let apiServiceInstance: ApiService | null = null;

/**
 * API 서비스 인스턴스 가져오기
 */
export function getApiService(): ApiService {
  if (!apiServiceInstance) {
    apiServiceInstance = new ApiService();
  }
  return apiServiceInstance;
}

/**
 * API 서비스 초기화
 */
export function initializeApiService(baseURL?: string): ApiService {
  apiServiceInstance = new ApiService(baseURL);
  return apiServiceInstance;
}