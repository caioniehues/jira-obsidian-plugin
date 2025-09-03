# JIRA API Service Documentation

## Overview

The JIRA API Service provides a comprehensive, production-ready implementation for interacting with JIRA Cloud REST API v3. It includes advanced features such as rate limiting, intelligent caching, retry logic with exponential backoff, and priority-based request queuing.

## Key Features

### ✅ **Rate Limiting (100 requests/minute)**
- Configurable rate limiting with sliding window algorithm
- Burst handling for better user experience
- Concurrent request limiting to prevent overwhelming the API
- Automatic rate limit detection and handling

### ✅ **Intelligent Caching & Request Deduplication**
- Request deduplication to prevent duplicate API calls
- Automatic cleanup of completed requests
- Memory leak prevention through proper promise management

### ✅ **Retry Logic with Exponential Backoff**
- Configurable retry attempts (default: 3 retries)
- Exponential backoff with jitter to prevent thundering herd
- Smart retry logic that only retries on retryable errors
- Maximum delay caps to prevent excessive wait times

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

### ✅ **Batch Operations**
- Batch update multiple issues
- Batch get multiple issues
- Batch transition multiple issues
- Automatic rate limiting and error handling for batch operations

## Installation and Setup

```typescript
import { JiraApiService } from './services/jiraApiService';
import { AuthManager } from './services/AuthManager';
import { HttpClient } from './services/httpClient';
import { RateLimiter } from './services/rateLimiter';

// Initialize dependencies
const authManager = new AuthManager(plugin);
const httpClient = new HttpClient({
  baseUrl: 'https://your-domain.atlassian.net',
  email: 'your-email@example.com',
  apiToken: 'your-api-token'
});
const rateLimiter = new RateLimiter({
  requestsPerMinute: 100,
  burstLimit: 100
});

// Create service instance
const jiraService = new JiraApiService(authManager, httpClient, rateLimiter);
```

## Authentication

### Getting Credentials

```typescript
// Get credentials with master password
const credentials = await jiraService.getCredentials('your-master-password');
console.log(credentials.email, credentials.serverUrl);
```

### Validating Credentials

```typescript
// Validate credentials
const isValid = await jiraService.validateCredentials(credentials);
if (isValid) {
  console.log('Credentials are valid');
}
```

### Testing Connection

```typescript
// Test connection
const result = await jiraService.testConnection('your-master-password');
if (result.success) {
  console.log('Connection successful');
} else {
  console.error('Connection failed:', result.message);
}
```

## Issue Operations

### Getting Issues

```typescript
// Get issue by key
const issue = await jiraService.getIssue('PROJ-123');

// Get issue by ID
const issueById = await jiraService.getIssue('10001');

console.log(issue.fields.summary);
console.log(issue.fields.status.name);
```

### Creating Issues

```typescript
// Create new issue
const newIssue = await jiraService.createIssue({
  fields: {
    project: { key: 'PROJ' },
    summary: 'New Issue Title',
    description: 'Issue description',
    issuetype: { name: 'Story' },
    assignee: { accountId: 'user-account-id' }
  }
});

console.log('Created issue:', newIssue.key);
```

### Updating Issues

```typescript
// Update issue
const updatedIssue = await jiraService.updateIssue('PROJ-123', {
  fields: {
    summary: 'Updated Issue Title',
    description: 'Updated description'
  }
});

console.log('Updated issue:', updatedIssue.key);
```

### Issue Transitions

```typescript
// Get available transitions
const transitions = await jiraService.getTransitions('PROJ-123');
console.log('Available transitions:', transitions.map(t => t.name));

// Transition issue
await jiraService.transitionIssue('PROJ-123', {
  transition: { id: '11' },
  fields: {
    resolution: { name: 'Done' }
  }
});
```

## Project Operations

### Getting Projects

```typescript
// Get all projects
const projects = await jiraService.getProjects();
console.log('Available projects:', projects.map(p => p.name));

// Get specific project
const project = await jiraService.getProject('PROJ');
console.log('Project details:', project.name, project.description);
```

## User Operations

### Getting Current User

```typescript
// Get current user
const currentUser = await jiraService.getCurrentUser();
console.log('Current user:', currentUser.displayName);
```

### Searching Users

```typescript
// Search users
const users = await jiraService.searchUsers('john');
console.log('Found users:', users.map(u => u.displayName));

// Search with limit
const limitedUsers = await jiraService.searchUsers('john', 10);
```

## Search Operations

### JQL Search

```typescript
// Search issues with JQL
const searchResults = await jiraService.searchIssues({
  jql: 'project = PROJ AND status = "To Do"',
  startAt: 0,
  maxResults: 50,
  fields: ['summary', 'status', 'assignee']
});

console.log('Found issues:', searchResults.total);
console.log('Issues:', searchResults.issues.map(i => i.key));
```

### Advanced Search

```typescript
// Advanced search with pagination
const advancedSearch = await jiraService.searchIssues({
  jql: 'assignee = currentUser() AND updated >= -7d',
  startAt: 0,
  maxResults: 100,
  fields: ['summary', 'status', 'updated', 'assignee'],
  expand: ['changelog']
});
```

## Batch Operations

### Batch Update Issues

```typescript
// Batch update multiple issues
const issueUpdates = [
  { issueIdOrKey: 'PROJ-123', updateData: { fields: { summary: 'Updated 1' } } },
  { issueIdOrKey: 'PROJ-124', updateData: { fields: { summary: 'Updated 2' } } },
  { issueIdOrKey: 'PROJ-125', updateData: { fields: { summary: 'Updated 3' } } }
];

const results = await jiraService.batchUpdateIssues(issueUpdates);

results.forEach(result => {
  if (result.result instanceof Error) {
    console.error(`Failed to update ${result.issueIdOrKey}:`, result.result.message);
  } else {
    console.log(`Updated ${result.issueIdOrKey}:`, result.result.fields.summary);
  }
});
```

### Batch Get Issues

```typescript
// Batch get multiple issues
const issueKeys = ['PROJ-123', 'PROJ-124', 'PROJ-125'];
const batchResults = await jiraService.batchGetIssues(issueKeys);

batchResults.forEach(result => {
  if (result.result instanceof Error) {
    console.error(`Failed to get ${result.issueIdOrKey}:`, result.result.message);
  } else {
    console.log(`Got ${result.issueIdOrKey}:`, result.result.fields.summary);
  }
});
```

### Batch Transition Issues

```typescript
// Batch transition multiple issues
const transitions = [
  { 
    issueIdOrKey: 'PROJ-123', 
    transitionRequest: { transition: { id: '11' } } 
  },
  { 
    issueIdOrKey: 'PROJ-124', 
    transitionRequest: { transition: { id: '21' } } 
  }
];

const transitionResults = await jiraService.batchTransitionIssues(transitions);

transitionResults.forEach(result => {
  if (result.result instanceof Error) {
    console.error(`Failed to transition ${result.issueIdOrKey}:`, result.result.message);
  } else {
    console.log(`Transitioned ${result.issueIdOrKey} successfully`);
  }
});
```

## Error Handling

### Error Types

The service provides comprehensive error handling with specific error types:

```typescript
try {
  const issue = await jiraService.getIssue('INVALID-123');
} catch (error) {
  switch (error.type) {
    case 'JIRA_API_ERROR':
      console.error('JIRA API error:', error.status, error.message);
      break;
    case 'NETWORK_ERROR':
      console.error('Network error:', error.message);
      break;
    case 'AUTHENTICATION_ERROR':
      console.error('Authentication error:', error.message);
      break;
    case 'RATE_LIMIT_ERROR':
      console.error('Rate limit exceeded:', error.retryAfter);
      break;
    case 'VALIDATION_ERROR':
      console.error('Validation error:', error.message);
      break;
  }
}
```

### Retry Logic

The service automatically handles retries for transient failures:

```typescript
// The service will automatically retry on network errors
// and certain API errors (5xx, rate limits)
const issue = await jiraService.getIssue('PROJ-123');
```

## Configuration

### HTTP Client Configuration

```typescript
// Get current configuration
const config = jiraService.getConfig();
console.log('Current config:', config);

// Update configuration
jiraService.updateConfig({
  timeout: 10000,
  maxRetries: 5
});
```

### Rate Limiter Statistics

```typescript
// Get rate limiter statistics
const stats = jiraService.getRateLimitStats();
console.log('Rate limiter stats:', {
  requestsPerMinute: stats.requestsPerMinute,
  currentTokens: stats.currentTokens,
  queueSize: stats.queueSize
});
```

## Memory Management

### Cleanup

```typescript
// Clean up resources when done
jiraService.destroy();
```

## Best Practices

### 1. Use Batch Operations for Multiple Items

```typescript
// Good: Use batch operations
const results = await jiraService.batchUpdateIssues(issueUpdates);

// Avoid: Multiple individual calls
for (const update of issueUpdates) {
  await jiraService.updateIssue(update.issueIdOrKey, update.updateData);
}
```

### 2. Handle Errors Gracefully

```typescript
// Good: Handle errors properly
try {
  const issue = await jiraService.getIssue('PROJ-123');
  // Process issue
} catch (error) {
  if (error.type === 'JIRA_API_ERROR' && error.status === 404) {
    console.log('Issue not found');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 3. Use Appropriate Search Parameters

```typescript
// Good: Use specific fields and pagination
const results = await jiraService.searchIssues({
  jql: 'project = PROJ',
  startAt: 0,
  maxResults: 50,
  fields: ['summary', 'status', 'assignee']
});

// Avoid: Fetching all fields for large result sets
const results = await jiraService.searchIssues({
  jql: 'project = PROJ',
  maxResults: 1000
  // No fields specified - fetches all fields
});
```

### 4. Monitor Rate Limits

```typescript
// Check rate limiter stats periodically
const stats = jiraService.getRateLimitStats();
if (stats.currentTokens < 10) {
  console.log('Rate limit getting low, consider throttling requests');
}
```

## TypeScript Support

The service provides full TypeScript support with branded types for type safety:

```typescript
import { 
  IssueKey, 
  ProjectKey, 
  UserId, 
  createIssueKey, 
  createProjectKey, 
  createUserId 
} from './types';

// Type-safe issue keys
const issueKey: IssueKey = createIssueKey('PROJ-123');
const projectKey: ProjectKey = createProjectKey('PROJ');
const userId: UserId = createUserId('user-account-id');

// Use with service methods
const issue = await jiraService.getIssue(issueKey);
const project = await jiraService.getProject(projectKey);
```

## Examples

### Complete Workflow Example

```typescript
async function completeJiraWorkflow() {
  try {
    // 1. Test connection
    const connectionResult = await jiraService.testConnection('master-password');
    if (!connectionResult.success) {
      throw new Error('Connection failed: ' + connectionResult.message);
    }

    // 2. Get current user
    const currentUser = await jiraService.getCurrentUser();
    console.log('Logged in as:', currentUser.displayName);

    // 3. Get projects
    const projects = await jiraService.getProjects();
    const project = projects.find(p => p.key === 'PROJ');
    
    if (!project) {
      throw new Error('Project PROJ not found');
    }

    // 4. Search for user's issues
    const myIssues = await jiraService.searchIssues({
      jql: `assignee = currentUser() AND project = ${project.key}`,
      maxResults: 50
    });

    console.log(`Found ${myIssues.total} issues assigned to you`);

    // 5. Batch update issues
    const issueUpdates = myIssues.issues.map(issue => ({
      issueIdOrKey: issue.key,
      updateData: {
        fields: {
          labels: [...issue.fields.labels, 'processed']
        }
      }
    }));

    const updateResults = await jiraService.batchUpdateIssues(issueUpdates);
    const successful = updateResults.filter(r => !(r.result instanceof Error));
    const failed = updateResults.filter(r => r.result instanceof Error);

    console.log(`Successfully updated ${successful.length} issues`);
    if (failed.length > 0) {
      console.log(`Failed to update ${failed.length} issues`);
    }

  } catch (error) {
    console.error('Workflow failed:', error);
  } finally {
    // Clean up
    jiraService.destroy();
  }
}
```

## API Reference

### JiraApiService Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `getCredentials(masterPassword)` | Get decrypted credentials | `masterPassword: string` | `Promise<JiraCredentials>` |
| `validateCredentials(credentials)` | Validate credentials | `credentials: JiraCredentials` | `Promise<boolean>` |
| `testConnection(masterPassword)` | Test connection | `masterPassword: string` | `Promise<{success: boolean, message: string}>` |
| `clearCredentials()` | Clear stored credentials | None | `Promise<void>` |
| `getIssue(issueIdOrKey)` | Get issue by key or ID | `issueIdOrKey: string \| IssueKey` | `Promise<JiraIssue>` |
| `createIssue(issueData)` | Create new issue | `issueData: any` | `Promise<JiraIssue>` |
| `updateIssue(issueIdOrKey, updateData)` | Update issue | `issueIdOrKey: string \| IssueKey, updateData: any` | `Promise<JiraIssue>` |
| `getTransitions(issueIdOrKey)` | Get available transitions | `issueIdOrKey: string \| IssueKey` | `Promise<JiraTransition[]>` |
| `transitionIssue(issueIdOrKey, transitionRequest)` | Transition issue | `issueIdOrKey: string \| IssueKey, transitionRequest: JiraTransitionRequest` | `Promise<void>` |
| `getProjects()` | Get all projects | None | `Promise<JiraProject[]>` |
| `getProject(projectIdOrKey)` | Get project by key or ID | `projectIdOrKey: string \| ProjectKey` | `Promise<JiraProject>` |
| `getCurrentUser()` | Get current user | None | `Promise<JiraUser>` |
| `searchUsers(query, maxResults?)` | Search users | `query: string, maxResults?: number` | `Promise<JiraUser[]>` |
| `searchIssues(searchParams)` | Search issues with JQL | `searchParams: JiraSearchParams` | `Promise<JiraSearchResult>` |
| `batchUpdateIssues(issueUpdates)` | Batch update issues | `issueUpdates: Array<{issueIdOrKey, updateData}>` | `Promise<Array<{issueIdOrKey: string, result: JiraIssue \| Error}>>` |
| `batchGetIssues(issueIdsOrKeys)` | Batch get issues | `issueIdsOrKeys: Array<string \| IssueKey>` | `Promise<Array<{issueIdOrKey: string, result: JiraIssue \| Error}>>` |
| `batchTransitionIssues(transitions)` | Batch transition issues | `transitions: Array<{issueIdOrKey, transitionRequest}>` | `Promise<Array<{issueIdOrKey: string, result: void \| Error}>>` |
| `getConfig()` | Get HTTP client config | None | `HttpClientConfig` |
| `updateConfig(config)` | Update HTTP client config | `config: Partial<HttpClientConfig>` | `void` |
| `getRateLimitStats()` | Get rate limiter stats | None | `RateLimitStats` |
| `destroy()` | Clean up resources | None | `void` |

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - The service automatically handles rate limiting
   - Check rate limiter stats to monitor usage
   - Consider reducing batch sizes for large operations

2. **Authentication Errors**
   - Verify credentials are correct
   - Check if API token has expired
   - Ensure proper permissions for the operations

3. **Network Errors**
   - The service automatically retries on network errors
   - Check internet connection
   - Verify JIRA server URL is correct

4. **Memory Issues**
   - Call `destroy()` when done with the service
   - Avoid keeping large result sets in memory
   - Use pagination for large searches

### Debug Mode

Enable debug logging by setting the environment variable:

```bash
NODE_ENV=development
```

This will enable detailed HTTP request/response logging.
