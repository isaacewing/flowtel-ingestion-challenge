export interface ApiEvent {
  id: string;
  sessionId: string;
  userId: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  timestamp: number | string; // Unix ms integer OR ISO 8601 string
  session: {
    id: string;
    deviceType: string;
    browser: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null; // from pagination.nextCursor in API response
  total?: number;
}

export interface RateLimitState {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}
