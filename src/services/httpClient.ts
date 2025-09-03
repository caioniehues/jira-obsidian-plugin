/**
 * HTTP Client Implementation
 * 
 * Axios-based HTTP client with comprehensive error handling, retry logic,
 * and rate limiting integration for JIRA API requests.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { RateLimiter } from './rateLimiter';
import { 
  JiraApiError, 
  NetworkError, 
  AuthenticationError, 
  RateLimitError,
  JiraServiceError 
} from './types';

export interface HttpClientConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  timeout?: number;
  maxRetries?: number;
}

export interface RequestOptions {
  retries?: number;
  headers?: Record<string, string>;
  timeout?: number;
  params?: Record<string, any>;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private config: Required<HttpClientConfig>;
  private rateLimiter?: RateLimiter;

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 5000,
      maxRetries: 3,
      ...config
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`
      }
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging and rate limiting
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Apply rate limiting if configured
        if (this.rateLimiter) {
          const rateLimitResult = await this.rateLimiter.acquireToken();
          if (!rateLimitResult.allowed) {
            throw this.createRateLimitError(rateLimitResult);
          }
        }

        // Log request (in development)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response (in development)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[HTTP] ${response.status} ${response.config.url}`);
        }
        return response;
      },
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Make a GET request
   */
  async get<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', url, data, options);
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', url, data, options);
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', url, data, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  /**
   * Make a generic HTTP request with retry logic
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.config.maxRetries;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          method,
          url,
          data,
          headers: options.headers,
          timeout: options.timeout,
          params: options.params
        };

        const response = await this.axiosInstance.request<T>(config);
        return response.data;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) or authentication errors
        if (this.isClientError(error) || this.isAuthError(error)) {
          throw error;
        }

        // Don't retry on rate limit errors
        if (this.isRateLimitError(error)) {
          throw error;
        }

        // Retry on server errors (5xx) and network errors
        if (attempt < maxRetries && (this.isServerError(error) || this.isNetworkError(error))) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any): JiraServiceError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Network errors
      if (!axiosError.response) {
        return this.createNetworkError(axiosError);
      }

      // HTTP response errors
      const status = axiosError.response.status;
      const data = axiosError.response.data as any;

      // Authentication errors
      if (status === 401 || status === 403) {
        return this.createAuthenticationError(axiosError, data);
      }

      // Rate limit errors
      if (status === 429) {
        return this.createRateLimitErrorFromResponse(axiosError);
      }

      // API errors
      return this.createApiError(axiosError, data);
    }

    // Non-axios errors
    return this.createNetworkError(error);
  }

  /**
   * Create network error
   */
  private createNetworkError(error: any): NetworkError {
    return {
      type: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
      code: error.code,
      cause: error,
      timestamp: new Date().toISOString(),
      url: error.config?.url
    };
  }

  /**
   * Create authentication error
   */
  private createAuthenticationError(error: AxiosError, data: any): AuthenticationError {
    const message = data?.errorMessages?.[0] || error.message || 'Authentication failed';
    
    return {
      type: 'AUTHENTICATION_ERROR',
      message,
      status: error.response!.status,
      timestamp: new Date().toISOString(),
      requestId: error.response?.headers?.['x-request-id']
    };
  }

  /**
   * Create rate limit error from rate limiter result
   */
  private createRateLimitError(result: any): RateLimitError {
    return {
      type: 'RATE_LIMIT_ERROR',
      message: 'Rate limit exceeded',
      retryAfter: result.retryAfter,
      limit: 100, // Default JIRA rate limit
      remaining: result.remaining || 0,
      resetTime: result.resetTime,
      timestamp: new Date().toISOString(),
      queueSize: 0,
      burstLimit: 10
    };
  }

  /**
   * Create rate limit error from HTTP response
   */
  private createRateLimitErrorFromResponse(error: AxiosError): RateLimitError {
    const headers = error.response!.headers;
    const retryAfter = parseInt(headers['retry-after'] || '60') * 1000;
    const limit = parseInt(headers['x-ratelimit-limit'] || '100');
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');

    return {
      type: 'RATE_LIMIT_ERROR',
      message: 'Rate limit exceeded',
      retryAfter,
      limit,
      remaining,
      resetTime: new Date(Date.now() + retryAfter).toISOString(),
      timestamp: new Date().toISOString(),
      queueSize: 0,
      burstLimit: 10
    };
  }

  /**
   * Create API error
   */
  private createApiError(error: AxiosError, data: any): JiraApiError {
    const message = data?.errorMessages?.[0] || error.message || 'API error occurred';
    
    return {
      type: 'JIRA_API_ERROR',
      status: error.response!.status,
      statusText: error.response!.statusText,
      message,
      errorMessages: data?.errorMessages,
      errors: data?.errors,
      timestamp: new Date().toISOString(),
      requestId: error.response?.headers?.['x-request-id']
    };
  }

  /**
   * Check if error is a client error (4xx)
   */
  private isClientError(error: any): boolean {
    return !!(axios.isAxiosError(error) && 
           error.response && 
           error.response.status >= 400 && 
           error.response.status < 500);
  }

  /**
   * Check if error is a server error (5xx)
   */
  private isServerError(error: any): boolean {
    return !!(axios.isAxiosError(error) && 
           error.response && 
           error.response.status >= 500);
  }

  /**
   * Check if error is an authentication error
   */
  private isAuthError(error: any): boolean {
    return !!(axios.isAxiosError(error) && 
           error.response && 
           (error.response.status === 401 || error.response.status === 403));
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return !!(axios.isAxiosError(error) && 
           error.response && 
           error.response.status === 429);
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    return !!(axios.isAxiosError(error) && !error.response);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set rate limiter
   */
  setRateLimiter(rateLimiter: RateLimiter): void {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<HttpClientConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HttpClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update axios instance
    this.axiosInstance.defaults.baseURL = this.config.baseUrl;
    this.axiosInstance.defaults.timeout = this.config.timeout;
    this.axiosInstance.defaults.headers['Authorization'] = 
      `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`;
  }
}