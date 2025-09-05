/**
 * JIRA API Service Implementation
 * 
 * Core service for interacting with JIRA REST API v3, providing comprehensive
 * functionality for issues, projects, users, and search operations with
 * authentication integration, rate limiting, and performance optimizations.
 */

import { AuthManager, JiraCredentials } from './AuthManager';
import { ObsidianHttpClient } from './ObsidianHttpClient';
import { HttpClientConfig } from './ObsidianHttpClient';
import { RateLimiter } from './rateLimiter';
import { 
  JiraIssue, 
  JiraProject, 
  JiraUser, 
  JiraSearchResult,
  JiraSearchParams,
  JiraTransition,
  JiraTransitionRequest,
  IssueKey,
  ProjectKey,
  UserId,
  JiraServiceError,
  RateLimitError,
  JiraComment,
  JiraCommentsResult,
  CreateCommentRequest,
  UpdateCommentRequest
} from './types';

export interface JiraApiServiceConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  timeout?: number;
  maxRetries?: number;
  requestsPerMinute?: number;
  burstLimit?: number;
}

export interface JiraApiServiceDependencies {
  authManager: AuthManager;
  httpClient: ObsidianHttpClient;
  rateLimiter: RateLimiter;
}

export class JiraApiService {
  private authManager: AuthManager;
  private httpClient: ObsidianHttpClient;
  private rateLimiter: RateLimiter;
  private requestDeduplicationMap: Map<string, Promise<any>> = new Map();

  constructor(
    authManager: AuthManager,
    httpClient: ObsidianHttpClient,
    rateLimiter: RateLimiter
  ) {
    this.authManager = authManager;
    this.httpClient = httpClient;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Get credentials from AuthManager with master password
   */
  async getCredentials(masterPassword: string): Promise<JiraCredentials> {
    const encryptedData = await this.authManager.getStoredCredentials();
    if (!encryptedData) {
      throw new Error('No credentials stored. Please configure JIRA connection first.');
    }
    
    return await this.authManager.decryptCredentials(encryptedData, masterPassword);
  }

  /**
   * Validate credentials against JIRA API
   */
  async validateCredentials(credentials?: JiraCredentials): Promise<boolean> {
    if (!credentials) {
      throw new Error('Credentials required for validation');
    }
    
    return await this.authManager.validateCredentials(credentials);
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<void> {
    await this.authManager.clearCredentials();
  }

  /**
   * Test connection with stored credentials
   */
  async testConnection(masterPassword: string): Promise<{ success: boolean; message: string }> {
    return await this.authManager.testConnection(masterPassword);
  }

  /**
   * Get issue by key or ID
   */
  async getIssue(issueIdOrKey: string | IssueKey): Promise<JiraIssue> {
    const cacheKey = `getIssue:${issueIdOrKey}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.get(`/rest/api/3/issue/${issueIdOrKey}`);
    });
  }

  /**
   * Create a new issue
   */
  async createIssue(issueData: any): Promise<JiraIssue> {
    await this.checkRateLimit();
    return await this.httpClient.post('/rest/api/3/issue', issueData);
  }

  /**
   * Update an existing issue
   */
  async updateIssue(issueIdOrKey: string | IssueKey, updateData: any): Promise<JiraIssue> {
    const cacheKey = `updateIssue:${issueIdOrKey}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.put(`/rest/api/3/issue/${issueIdOrKey}`, updateData);
    });
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueIdOrKey: string | IssueKey): Promise<JiraTransition[]> {
    const cacheKey = `getTransitions:${issueIdOrKey}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      const response = await this.httpClient.get(`/rest/api/3/issue/${issueIdOrKey}/transitions`);
      return response.transitions || [];
    });
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueIdOrKey: string | IssueKey, transitionRequest: JiraTransitionRequest): Promise<void> {
    await this.checkRateLimit();
    await this.httpClient.post(`/rest/api/3/issue/${issueIdOrKey}/transitions`, transitionRequest);
  }

  /**
   * Get all accessible projects
   */
  async getProjects(): Promise<JiraProject[]> {
    const cacheKey = 'getProjects';
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.get('/rest/api/3/project');
    });
  }

  /**
   * Get project by key or ID
   */
  async getProject(projectIdOrKey: string | ProjectKey): Promise<JiraProject> {
    const cacheKey = `getProject:${projectIdOrKey}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.get(`/rest/api/3/project/${projectIdOrKey}`);
    });
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<JiraUser> {
    const cacheKey = 'getCurrentUser';
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.get('/rest/api/3/myself');
    });
  }

  /**
   * Search for users
   */
  async searchUsers(query: string, maxResults?: number): Promise<JiraUser[]> {
    const cacheKey = `searchUsers:${query}:${maxResults || 'default'}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      const params: any = { query };
      if (maxResults) {
        params.maxResults = maxResults;
      }
      return await this.httpClient.get('/rest/api/3/user/search', { params });
    });
  }

  /**
   * Search issues using JQL
   */
  async searchIssues(searchParams: JiraSearchParams): Promise<JiraSearchResult> {
    const cacheKey = `searchIssues:${JSON.stringify(searchParams)}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      
      // Set default values for optional parameters
      const params = {
        jql: searchParams.jql,
        startAt: searchParams.startAt ?? 0,
        maxResults: searchParams.maxResults ?? 50,
        ...(searchParams.fields && { fields: searchParams.fields }),
        ...(searchParams.expand && { expand: searchParams.expand })
      };
      
      return await this.httpClient.get('/rest/api/3/search', { params });
    });
  }

  /**
   * Batch operations for multiple issues
   */
  async batchUpdateIssues(issueUpdates: Array<{
    issueIdOrKey: string | IssueKey;
    updateData: any;
  }>): Promise<Array<{ issueIdOrKey: string; result: JiraIssue | Error }>> {
    const results: Array<{ issueIdOrKey: string; result: JiraIssue | Error }> = [];
    
    // Process updates in batches to respect rate limits
    const batchSize = 10; // Conservative batch size
    for (let i = 0; i < issueUpdates.length; i += batchSize) {
      const batch = issueUpdates.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async ({ issueIdOrKey, updateData }) => {
        try {
          const result = await this.updateIssue(issueIdOrKey, updateData);
          return { issueIdOrKey: String(issueIdOrKey), result };
        } catch (error) {
          return { issueIdOrKey: String(issueIdOrKey), result: error as Error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add small delay between batches to be respectful to the API
      if (i + batchSize < issueUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Batch get multiple issues
   */
  async batchGetIssues(issueIdsOrKeys: Array<string | IssueKey>): Promise<Array<{ issueIdOrKey: string; result: JiraIssue | Error }>> {
    const results: Array<{ issueIdOrKey: string; result: JiraIssue | Error }> = [];
    
    // Process gets in batches to respect rate limits
    const batchSize = 20; // Larger batch size for read operations
    for (let i = 0; i < issueIdsOrKeys.length; i += batchSize) {
      const batch = issueIdsOrKeys.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (issueIdOrKey) => {
        try {
          const result = await this.getIssue(issueIdOrKey);
          return { issueIdOrKey: String(issueIdOrKey), result };
        } catch (error) {
          return { issueIdOrKey: String(issueIdOrKey), result: error as Error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add small delay between batches
      if (i + batchSize < issueIdsOrKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  /**
   * Batch transition multiple issues
   */
  async batchTransitionIssues(transitions: Array<{
    issueIdOrKey: string | IssueKey;
    transitionRequest: JiraTransitionRequest;
  }>): Promise<Array<{ issueIdOrKey: string; result: void | Error }>> {
    const results: Array<{ issueIdOrKey: string; result: void | Error }> = [];
    
    // Process transitions in batches
    const batchSize = 10;
    for (let i = 0; i < transitions.length; i += batchSize) {
      const batch = transitions.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async ({ issueIdOrKey, transitionRequest }) => {
        try {
          await this.transitionIssue(issueIdOrKey, transitionRequest);
          return { issueIdOrKey: String(issueIdOrKey), result: undefined as void };
        } catch (error) {
          return { issueIdOrKey: String(issueIdOrKey), result: error as Error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches
      if (i + batchSize < transitions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Get HTTP client configuration
   */
  getConfig(): HttpClientConfig {
    return this.httpClient.getConfig();
  }

  /**
   * Update HTTP client configuration
   */
  updateConfig(config: Partial<HttpClientConfig>): void {
    this.httpClient.updateConfig(config);
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }

  /**
   * Check rate limit and throw error if exceeded
   */
  private async checkRateLimit(): Promise<void> {
    const rateLimitResult = await this.rateLimiter.acquireToken();
    if (!rateLimitResult.allowed) {
      throw {
        type: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Request deduplication to prevent duplicate API calls
   */
  private async deduplicateRequest<T>(cacheKey: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if request is already in progress
    if (this.requestDeduplicationMap.has(cacheKey)) {
      return this.requestDeduplicationMap.get(cacheKey)!;
    }

    // Create new request promise
    const requestPromise = requestFn().finally(() => {
      // Clean up after request completion
      this.requestDeduplicationMap.delete(cacheKey);
    });

    // Store promise in deduplication map
    this.requestDeduplicationMap.set(cacheKey, requestPromise);

    return requestPromise;
  }

  /**
   * Get comments for an issue
   */
  async getComments(issueIdOrKey: string | IssueKey): Promise<JiraCommentsResult> {
    const cacheKey = `getComments:${issueIdOrKey}`;
    return this.deduplicateRequest(cacheKey, async () => {
      await this.checkRateLimit();
      return await this.httpClient.get(`/rest/api/3/issue/${issueIdOrKey}/comment`);
    });
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueIdOrKey: string | IssueKey, comment: CreateCommentRequest): Promise<JiraComment> {
    await this.checkRateLimit();
    return await this.httpClient.post(`/rest/api/3/issue/${issueIdOrKey}/comment`, comment);
  }

  /**
   * Update an existing comment
   */
  async updateComment(issueIdOrKey: string | IssueKey, commentId: string, comment: UpdateCommentRequest): Promise<JiraComment> {
    await this.checkRateLimit();
    return await this.httpClient.put(`/rest/api/3/issue/${issueIdOrKey}/comment/${commentId}`, comment);
  }

  /**
   * Delete a comment
   */
  async deleteComment(issueIdOrKey: string | IssueKey, commentId: string): Promise<void> {
    await this.checkRateLimit();
    return await this.httpClient.delete(`/rest/api/3/issue/${issueIdOrKey}/comment/${commentId}`);
  }

  /**
   * Clean up resources and clear deduplication map
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.requestDeduplicationMap.clear();
  }
}
