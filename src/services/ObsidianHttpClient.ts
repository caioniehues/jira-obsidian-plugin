/**
 * Obsidian-specific HTTP Client Implementation
 * 
 * Uses Obsidian's requestUrl API to bypass CORS restrictions
 * when making requests to external APIs like Jira
 */

import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
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

export class ObsidianHttpClient {
  private config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 30000, // 30 seconds - Obsidian default
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Make a GET request using Obsidian's API
   */
  async get<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  /**
   * Make a POST request using Obsidian's API
   */
  async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', url, data, options);
  }

  /**
   * Make a PUT request using Obsidian's API
   */
  async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', url, data, options);
  }

  /**
   * Make a DELETE request using Obsidian's API
   */
  async delete<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  /**
   * Make a generic HTTP request with retry logic using Obsidian's requestUrl
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.config.maxRetries;
    let lastError: Error;

    // Build full URL with query parameters
    const fullUrl = this.buildUrl(url, options.params);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Prepare authorization header
        const authString = btoa(`${this.config.email}:${this.config.apiToken}`);
        
        // Build request configuration for Obsidian's requestUrl
        const requestConfig: RequestUrlParam = {
          url: fullUrl,
          method: method,
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: data ? JSON.stringify(data) : undefined,
          throw: false // We'll handle errors ourselves
        };

        console.log(`[ObsidianHttp] ${method} ${fullUrl}`);
        
        // Make the request using Obsidian's API
        const response: RequestUrlResponse = await requestUrl(requestConfig);
        
        // Check response status
        if (response.status >= 200 && response.status < 300) {
          // Parse JSON response
          if (response.headers['content-type']?.includes('application/json')) {
            return response.json as T;
          }
          return response.text as any as T;
        }

        // Handle error responses
        const error = this.handleErrorResponse(response);
        
        // Don't retry on client errors (4xx) or authentication errors
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }

        // Retry on server errors (5xx) and network errors
        if (attempt < maxRetries && response.status >= 500) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on non-retryable errors
        if (attempt >= maxRetries) {
          throw error;
        }

        // Check if error is retryable
        if (this.isRetryableError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          console.log(`[ObsidianHttp] Retry attempt ${attempt + 1} after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
    
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    return `${url}?${queryString}`;
  }

  /**
   * Handle error responses and create appropriate error objects
   */
  private handleErrorResponse(response: RequestUrlResponse): JiraServiceError {
    const status = response.status;
    let errorData: any = {};
    
    try {
      errorData = response.json || {};
    } catch {
      // If JSON parsing fails, use text
      errorData = { message: response.text || response.status.toString() };
    }

    // Authentication errors
    if (status === 401 || status === 403) {
      return {
        type: 'AUTHENTICATION_ERROR',
        message: errorData.message || errorData.errorMessages?.[0] || 'Authentication failed',
        status: status,
        timestamp: new Date().toISOString()
      } as AuthenticationError;
    }

    // Rate limit errors
    if (status === 429) {
      return {
        type: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded',
        retryAfter: parseInt(response.headers['retry-after'] || '60') * 1000,
        limit: parseInt(response.headers['x-ratelimit-limit'] || '100'),
        remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
        resetTime: new Date(Date.now() + 60000).toISOString(),
        timestamp: new Date().toISOString()
      } as RateLimitError;
    }

    // API errors
    return {
      type: 'JIRA_API_ERROR',
      status: status,
      statusText: response.status.toString(),
      message: errorData.message || errorData.errorMessages?.[0] || 'API error occurred',
      errorMessages: errorData.errorMessages,
      errors: errorData.errors,
      timestamp: new Date().toISOString()
    } as JiraApiError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Network errors are retryable
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      return true;
    }
    
    // Server errors (5xx) are retryable
    if (error.status >= 500) {
      return true;
    }
    
    return false;
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
  }
}