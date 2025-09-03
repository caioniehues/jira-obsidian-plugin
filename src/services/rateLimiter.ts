/**
 * Rate Limiter Implementation
 * 
 * Implements a token bucket algorithm for rate limiting JIRA API requests.
 * Follows TDD, KISS, and DRY principles.
 */

export interface RateLimiterConfig {
  requestsPerMinute: number;
  burstLimit: number;
  queueTimeout?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  error?: string;
}

export interface RateLimitStats {
  requestsPerMinute: number;
  burstLimit: number;
  currentTokens: number;
  queueSize: number;
  lastRefillTime: number;
}

export class RateLimiter {
  private config: Required<RateLimiterConfig>;
  private tokens: number;
  private lastRefillTime: number;
  private queue: Array<{
    resolve: (result: RateLimitResult) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private refillInterval: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = {
      requestsPerMinute: config.requestsPerMinute,
      burstLimit: config.burstLimit,
      queueTimeout: config.queueTimeout || 30000 // 30 seconds default
    };

    this.tokens = this.config.burstLimit;
    this.lastRefillTime = Date.now();
    
    // Start refill timer
    this.refillInterval = setInterval(() => {
      this.refillTokens();
    }, 1000); // Check every second
  }

  /**
   * Acquire a token for making a request
   */
  async acquireToken(): Promise<RateLimitResult> {
    this.refillTokens();

    // If we have tokens available, use one immediately
    if (this.tokens > 0) {
      this.tokens--;
      return {
        allowed: true,
        remaining: this.tokens
      };
    }

    // No tokens available, reject immediately with retry info
    return {
      allowed: false,
      remaining: 0,
      retryAfter: this.calculateRetryAfter(),
      error: 'RATE_LIMITED'
    };
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    
    // Calculate tokens to add based on elapsed time
    const tokensToAdd = (elapsed / 60000) * this.config.requestsPerMinute;
    
    if (tokensToAdd >= 1) {
      this.tokens = Math.min(
        this.config.burstLimit,
        this.tokens + Math.floor(tokensToAdd)
      );
      this.lastRefillTime = now;
      
      // Process queued requests when tokens are available
      this.processQueue();
    }
  }

  /**
   * Process queued requests when tokens become available
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens > 0) {
      const queueItem = this.queue.shift();
      if (queueItem) {
        this.tokens--;
        queueItem.resolve({
          allowed: true,
          remaining: this.tokens
        });
      }
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get rate limiter statistics
   */
  getStats(): RateLimitStats {
    return {
      requestsPerMinute: this.config.requestsPerMinute,
      burstLimit: this.config.burstLimit,
      currentTokens: this.tokens,
      queueSize: this.queue.length,
      lastRefillTime: this.lastRefillTime
    };
  }

  /**
   * Calculate retry after time in milliseconds
   */
  private calculateRetryAfter(): number {
    if (this.tokens > 0) {
      return 0;
    }

    // Calculate time until next token is available
    const tokensNeeded = 1;
    const timePerToken = 60000 / this.config.requestsPerMinute;
    return Math.ceil(tokensNeeded * timePerToken);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }

    // Resolve all queued requests with timeout error
    this.queue.forEach(item => {
      item.resolve({
        allowed: false,
        remaining: 0,
        error: 'RATE_LIMITER_DESTROYED'
      });
    });
    this.queue = [];
  }
}
