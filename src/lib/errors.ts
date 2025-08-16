/**
 * 기본 커스텀 에러 클래스
 */
export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Error 클래스를 상속할 때 필요한 설정
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * 유효성 검증 에러
 */
export class ValidationError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * 인증 에러
 */
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

/**
 * 권한 에러
 */
export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

/**
 * 리소스 찾을 수 없음 에러
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

/**
 * 충돌 에러
 */
export class ConflictError extends BaseError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLICT', 409, details);
  }
}

/**
 * 요청 제한 에러
 */
export class RateLimitError extends BaseError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

/**
 * 서버 내부 에러
 */
export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
  }
}

/**
 * 서비스 이용 불가 에러
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}

/**
 * 타임아웃 에러
 */
export class TimeoutError extends BaseError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT', 408);
  }
}

/**
 * 네트워크 에러
 */
export class NetworkError extends BaseError {
  constructor(message: string = 'Network error occurred') {
    super(message, 'NETWORK_ERROR', 0);
  }
}

/**
 * 외부 서비스 에러
 */
export class ExternalServiceError extends BaseError {
  constructor(service: string, message: string, details?: any) {
    super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, details);
  }
}

/**
 * 비즈니스 로직 에러
 */
export class BusinessLogicError extends BaseError {
  constructor(message: string, code: string = 'BUSINESS_LOGIC_ERROR', details?: any) {
    super(message, code, 422, details);
  }
}

/**
 * 에러 타입 체크 유틸리티
 */
export function isBaseError(error: any): error is BaseError {
  return error instanceof BaseError;
}

/**
 * HTTP 상태 코드에 따른 에러 생성
 */
export function createErrorFromStatus(status: number, message?: string, details?: any): BaseError {
  switch (status) {
    case 400:
      return new ValidationError(message || 'Bad request', details);
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError(message || 'Resource', undefined);
    case 409:
      return new ConflictError(message || 'Conflict occurred', details);
    case 429:
      return new RateLimitError(message);
    case 408:
      return new TimeoutError(message);
    case 500:
      return new InternalServerError(message, details);
    case 502:
      return new ExternalServiceError('External', message || 'Bad gateway', details);
    case 503:
      return new ServiceUnavailableError(message);
    default:
      return new BaseError(
        message || `HTTP Error ${status}`,
        `HTTP_${status}`,
        status,
        details
      );
  }
}

/**
 * 에러 로깅 유틸리티
 */
export function logError(error: Error | BaseError): void {
  if (isBaseError(error)) {
    console.error('[Error]', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      timestamp: error.timestamp
    });
  } else {
    console.error('[Error]', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}