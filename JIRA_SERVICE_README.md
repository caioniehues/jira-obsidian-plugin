# Jira API Service Implementation

## Overview

The `JiraService` class provides a comprehensive, production-ready implementation for interacting with the Jira Cloud REST API. It includes advanced features such as rate limiting, intelligent caching, retry logic with exponential backoff, and priority-based request queuing.

## Key Features

### ✅ **Rate Limiting (100 requests/minute)**
- Configurable rate limiting with sliding window algorithm
- Burst handling for better user experience
- Concurrent request limiting to prevent overwhelming the API
- Automatic rate limit detection and handling

### ✅ **Intelligent Caching (5-minute TTL)**
- Multi-level caching with memory and optional disk storage
- Configurable TTL (Time To Live) per cache entry
- Automatic cache invalidation on updates
- Cache hit/miss statistics and performance monitoring

### ✅ **Retry Logic with Exponential Backoff**
- Configurable retry attempts (default: 3 retries)
- Exponential backoff with jitter to prevent thundering herd
- Smart retry logic that only retries on retryable errors
- Maximum delay caps to prevent excessive wait times

### ✅ **Priority Queue for API Requests**
- Four priority levels: CRITICAL, HIGH, MEDIUM, LOW
- Timestamp-based tie-breaking for same priority requests
- User-initiated actions get higher priority
- Background operations use lower priority

### ✅ **Comprehensive Error Handling**
- Detailed error classification and handling
- User-friendly error messages
- Network error detection and recovery
- Authentication error detection

### ✅ **Integration with AuthManager**
- Secure credential management
- Automatic authentication header injection
- Credential validation and refresh

### ✅ **Full TypeScript Support**
- Complete type definitions
- Branded types for type safety (IssueKey, UserId, etc.)
- Comprehensive interfaces for all API responses

## API Methods

### Core Methods

#### `fetchTasks(jql: string, options?): Promise<JiraTask[]>`
Fetch tasks using JQL (Jira Query Language) with caching and rate limiting.

```typescript
const tasks = await jiraService.fetchTasks(
  'assignee = currentUser() AND status != Done',
  {
    maxResults: 50,
    priority: 'HIGH',
    useCache: true
  }
);
```

#### `fetchSingleTask(key: IssueKey, options?): Promise<JiraTask | null>`
Fetch a single task by its key with caching.

```typescript
const task = await jiraService.fetchSingleTask('PROJ-123' as IssueKey, {
  priority: 'HIGH',
  useCache: true
});
```

#### `updateTask(key: IssueKey, fields: Record<string, any>, options?): Promise<void>`
Update a task with the specified fields.

```typescript
await jiraService.updateTask('PROJ-123' as IssueKey, {
  summary: 'Updated task title',
  assignee: 'user123',
  priority: '2'
}, {
  priority: 'CRITICAL',
  invalidateCache: true
});
```

#### `bulkUpdateTasks(updates: Array<{key: IssueKey, fields: Record<string, any>}>, options?): Promise<void>`
Update multiple tasks in efficient batches.

```typescript
await jiraService.bulkUpdateTasks([
  { key: 'PROJ-123' as IssueKey, fields: { status: 'In Progress' } },
  { key: 'PROJ-124' as IssueKey, fields: { priority: '1' } }
], {
  priority: 'HIGH',
  batchSize: 10
});
```

### Management Methods

#### `getStats(): ServiceStats`
Get comprehensive service statistics and performance metrics.

```typescript
const stats = jiraService.getStats();
console.log('Cache hit rate:', stats.cache.hitRate);
console.log('Queue length:', stats.rateLimiter.queueLength);
console.log('Success rate:', (stats.requests.successfulRequests / stats.requests.totalRequests) * 100);
```

#### `clearCache(): Promise<void>`
Clear all cached data.

#### `shutdown(): Promise<void>`
Gracefully shutdown the service, clearing queues and caches.

## Configuration

### Rate Limiting Configuration

```typescript
const jiraService = new JiraService(plugin, {
  rateLimit: {
    requestsPerMinute: 100,    // Maximum requests per minute
    burstLimit: 20,           // Allow bursts for better UX
    concurrentLimit: 10       // Maximum concurrent requests
  }
});
```

### Caching Configuration

```typescript
const jiraService = new JiraService(plugin, {
  cache: {
    ttlMs: 5 * 60 * 1000,     // 5 minutes cache lifetime
    maxMemoryEntries: 1000,    // Maximum entries in memory
    enableDiskCache: true      // Enable persistent caching
  }
});
```

### Retry Configuration

```typescript
const jiraService = new JiraService(plugin, {
  retry: {
    maxRetries: 3,             // Maximum retry attempts
    baseDelayMs: 1000,         // Initial retry delay
    maxDelayMs: 30000,         // Maximum retry delay
    backoffFactor: 2           // Exponential backoff multiplier
  }
});
```

## Usage Examples

### Basic Task Fetching

```typescript
import { JiraService } from './services/JiraService';
import { IssueKey } from './types';

// Initialize service
const jiraService = new JiraService(plugin);

// Fetch user's tasks
try {
  const myTasks = await jiraService.fetchTasks(
    'assignee = currentUser() AND status != Done ORDER BY priority DESC'
  );
  console.log(`Found ${myTasks.length} active tasks`);
} catch (error) {
  console.error('Failed to fetch tasks:', error);
}
```

### Task Updates with Error Handling

```typescript
async function updateTaskPriority(key: IssueKey, priority: string) {
  try {
    await jiraService.updateTask(key, { priority }, {
      priority: 'HIGH' // This update request has high priority
    });
    console.log(`Updated priority for ${key}`);
    return true;
  } catch (error) {
    if (error.message.includes('403')) {
      throw new Error('Permission denied - cannot update this task');
    } else if (error.message.includes('404')) {
      throw new Error('Task not found or has been deleted');
    }
    throw error;
  }
}
```

### Batch Operations

```typescript
async function bulkAssignTasks(taskKeys: IssueKey[], assigneeId: string) {
  const updates = taskKeys.map(key => ({
    key,
    fields: { assignee: assigneeId }
  }));

  await jiraService.bulkUpdateTasks(updates, {
    batchSize: 10, // Process 10 at a time
    priority: 'MEDIUM'
  });

  console.log(`Assigned ${taskKeys.length} tasks to ${assigneeId}`);
}
```

### Monitoring Service Health

```typescript
function monitorJiraService() {
  const stats = jiraService.getStats();
  
  // Check error rate
  const errorRate = (stats.requests.failedRequests / stats.requests.totalRequests) * 100;
  if (errorRate > 10) {
    console.warn('High error rate detected:', errorRate + '%');
  }
  
  // Check cache performance
  if (stats.cache.hitRate < 50 && stats.requests.totalRequests > 20) {
    console.warn('Low cache hit rate:', stats.cache.hitRate + '%');
  }
  
  // Check rate limiting
  if (stats.requests.rateLimitHits > 0) {
    console.warn('Rate limiting occurred:', stats.requests.rateLimitHits, 'times');
  }
  
  // Check queue health
  if (stats.rateLimiter.queueLength > 50) {
    console.warn('High request queue length:', stats.rateLimiter.queueLength);
  }
}

// Monitor every 30 seconds
setInterval(monitorJiraService, 30000);
```

## Integration with Obsidian Plugin

### Plugin Integration

```typescript
// main.ts
import { JiraService } from './services/JiraService';

export default class JiraPlugin extends Plugin {
  private jiraService: JiraService;

  async onload() {
    // Initialize with configuration based on plugin settings
    this.jiraService = new JiraService(this, {
      rateLimit: {
        requestsPerMinute: this.settings.performance.rateLimit || 100,
        concurrentLimit: this.settings.performance.concurrentRequests || 10
      },
      cache: {
        ttlMs: this.settings.cacheStrategy === 'aggressive' ? 2 * 60 * 1000 : 5 * 60 * 1000,
        maxMemoryEntries: this.settings.performance.maxCacheEntries || 1000
      }
    });

    // Add commands
    this.addCommand({
      id: 'fetch-jira-tasks',
      name: 'Fetch Jira Tasks',
      callback: async () => {
        const tasks = await this.jiraService.fetchTasks('assignee = currentUser()');
        // Update UI with tasks
      }
    });
  }

  async onunload() {
    await this.jiraService.shutdown();
  }

  getJiraService(): JiraService {
    return this.jiraService;
  }
}
```

### View Integration

```typescript
// views/JiraView.ts
export class JiraView extends ItemView {
  private jiraService: JiraService;

  constructor(leaf: WorkspaceLeaf, private plugin: JiraPlugin) {
    super(leaf);
    this.jiraService = plugin.getJiraService();
  }

  async refreshTasks() {
    try {
      this.showLoading();
      
      const tasks = await this.jiraService.fetchTasks(
        this.getCurrentJQL(),
        { priority: 'HIGH' }
      );
      
      this.renderTasks(tasks);
    } catch (error) {
      this.showError(this.getErrorMessage(error));
    } finally {
      this.hideLoading();
    }
  }

  private getErrorMessage(error: any): string {
    if (error.message?.includes('RATE_LIMITED')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.message?.includes('401')) {
      return 'Authentication failed. Please check your Jira credentials.';
    }
    return 'An error occurred while fetching tasks.';
  }
}
```

## Performance Considerations

### Memory Management
- The service automatically manages memory cache size
- Implements LRU eviction when cache limits are reached
- Monitors cache hit rates for optimization opportunities

### Network Optimization
- Batches requests when possible to reduce API calls
- Implements intelligent retry logic to handle transient failures
- Uses priority queues to optimize user-perceived performance

### Error Recovery
- Gracefully handles rate limiting with automatic retry
- Provides detailed error information for debugging
- Maintains service availability even during API issues

## Testing

The service includes comprehensive tests covering:
- Rate limiting behavior
- Cache functionality
- Error handling and retry logic
- Priority queue operations
- Authentication integration

Run tests with:
```bash
npm test JiraService
```

## Monitoring and Debugging

### Enable Debug Logging
```typescript
// Add to plugin settings
const jiraService = new JiraService(plugin, config);

// Monitor service statistics
setInterval(() => {
  const stats = jiraService.getStats();
  console.log('JiraService Stats:', stats);
}, 60000);
```

### Common Issues and Solutions

1. **Rate Limiting**: Reduce request frequency or increase cache TTL
2. **Authentication Errors**: Verify credentials in AuthManager
3. **Network Errors**: Check internet connection and Jira server status
4. **Memory Issues**: Reduce cache size or enable disk caching

## Conclusion

The JiraService implementation provides a robust, production-ready solution for integrating with Jira Cloud APIs in Obsidian plugins. It handles the complexity of rate limiting, caching, and error recovery while providing a clean, type-safe API for developers to use.

The service is designed to be highly configurable and extensible, allowing for customization based on specific plugin requirements while maintaining optimal performance and reliability.