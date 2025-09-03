import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JiraApiService } from '../jiraApiService';
import { AuthManager } from '../AuthManager';
import { HttpClient } from '../httpClient';
import { RateLimiter } from '../rateLimiter';
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
  createIssueKey,
  createProjectKey,
  createUserId
} from '../types';

// Mock dependencies
jest.mock('../AuthManager');
jest.mock('../httpClient');
jest.mock('../rateLimiter');

describe('JiraApiService Integration Tests', () => {
  let jiraApiService: JiraApiService;
  let mockAuthManager: any;
  let mockHttpClient: any;
  let mockRateLimiter: any;

  const mockCredentials = {
    email: 'test@example.com',
    apiToken: 'test-token',
    serverUrl: 'https://test.atlassian.net'
  };

  const mockIssue: JiraIssue = {
    id: '10001',
    key: createIssueKey('TEST-123'),
    self: 'https://test.atlassian.net/rest/api/3/issue/10001',
    fields: {
      summary: 'Test Issue',
      description: 'Test Description',
      status: {
        id: '1',
        name: 'To Do',
        iconUrl: 'https://test.atlassian.net/images/icons/statuses/open.png',
        self: 'https://test.atlassian.net/rest/api/3/status/1',
        statusCategory: {
          id: 2,
          key: 'new',
          colorName: 'blue-gray',
          name: 'To Do'
        }
      },
      priority: {
        id: '3',
        name: 'Medium',
        iconUrl: 'https://test.atlassian.net/images/icons/priorities/medium.svg',
        self: 'https://test.atlassian.net/rest/api/3/priority/3'
      },
      reporter: {
        accountId: createUserId('user1'),
        accountType: 'atlassian',
        active: true,
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        self: 'https://test.atlassian.net/rest/api/3/user?accountId=user1',
        avatarUrls: {
          '16x16': 'https://test.atlassian.net/avatar/16x16/user1.png',
          '24x24': 'https://test.atlassian.net/avatar/24x24/user1.png',
          '32x32': 'https://test.atlassian.net/avatar/32x32/user1.png',
          '48x48': 'https://test.atlassian.net/avatar/48x48/user1.png'
        }
      },
      created: '2023-01-01T00:00:00.000Z',
      updated: '2023-01-01T00:00:00.000Z',
      project: {
        id: '10000',
        key: createProjectKey('TEST'),
        name: 'Test Project',
        projectTypeKey: 'software',
        self: 'https://test.atlassian.net/rest/api/3/project/10000',
        lead: {
          accountId: createUserId('user1'),
          accountType: 'atlassian',
          active: true,
          displayName: 'Test User',
          emailAddress: 'test@example.com',
          self: 'https://test.atlassian.net/rest/api/3/user?accountId=user1',
          avatarUrls: {
            '16x16': 'https://test.atlassian.net/avatar/16x16/user1.png',
            '24x24': 'https://test.atlassian.net/avatar/24x24/user1.png',
            '32x32': 'https://test.atlassian.net/avatar/32x32/user1.png',
            '48x48': 'https://test.atlassian.net/avatar/48x48/user1.png'
          }
        },
        assigneeType: 'PROJECT_LEAD',
        versions: [],
        components: [],
        issueTypes: [],
        roles: {}
      },
      issuetype: {
        id: '10001',
        name: 'Story',
        description: 'A user story',
        iconUrl: 'https://test.atlassian.net/images/icons/issuetypes/story.svg',
        self: 'https://test.atlassian.net/rest/api/3/issuetype/10001',
        subtask: false
      },
      labels: ['test', 'example'],
      components: [],
      fixVersions: []
    }
  };

  const mockProject: JiraProject = {
    id: '10000',
    key: createProjectKey('TEST'),
    name: 'Test Project',
    projectTypeKey: 'software',
    self: 'https://test.atlassian.net/rest/api/3/project/10000',
    lead: {
      accountId: createUserId('user1'),
      accountType: 'atlassian',
      active: true,
      displayName: 'Test User',
      emailAddress: 'test@example.com',
      self: 'https://test.atlassian.net/rest/api/3/user?accountId=user1',
      avatarUrls: {
        '16x16': 'https://test.atlassian.net/avatar/16x16/user1.png',
        '24x24': 'https://test.atlassian.net/avatar/24x24/user1.png',
        '32x32': 'https://test.atlassian.net/avatar/32x32/user1.png',
        '48x48': 'https://test.atlassian.net/avatar/48x48/user1.png'
      }
    },
    assigneeType: 'PROJECT_LEAD',
    versions: [],
    components: [],
    issueTypes: [],
    roles: {}
  };

  const mockUser: JiraUser = {
    accountId: createUserId('user1'),
    accountType: 'atlassian',
    active: true,
    displayName: 'Test User',
    emailAddress: 'test@example.com',
    self: 'https://test.atlassian.net/rest/api/3/user?accountId=user1',
    avatarUrls: {
      '16x16': 'https://test.atlassian.net/avatar/16x16/user1.png',
      '24x24': 'https://test.atlassian.net/avatar/24x24/user1.png',
      '32x32': 'https://test.atlassian.net/avatar/32x32/user1.png',
      '48x48': 'https://test.atlassian.net/avatar/48x48/user1.png'
    }
  };

  beforeEach(() => {
    // Create mock instances
    mockAuthManager = {
      getStoredCredentials: jest.fn(() => Promise.resolve({ encrypted: 'test', iv: 'test', salt: 'test' })),
      decryptCredentials: jest.fn(() => Promise.resolve(mockCredentials)),
      validateCredentials: jest.fn(() => Promise.resolve(true)),
      clearCredentials: jest.fn(() => Promise.resolve(undefined)),
      testConnection: jest.fn(() => Promise.resolve({ success: true, message: 'Connection successful' }))
    };

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      getConfig: jest.fn(() => ({
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        timeout: 5000,
        maxRetries: 3
      })),
      updateConfig: jest.fn()
    };

    mockRateLimiter = {
      acquireToken: jest.fn(() => Promise.resolve({ allowed: true, remaining: 99 })),
      getStats: jest.fn(() => ({
        requestsPerMinute: 100,
        burstLimit: 100,
        currentTokens: 99,
        queueSize: 0,
        lastRefillTime: Date.now()
      })),
      destroy: jest.fn()
    };

    jiraApiService = new JiraApiService(mockAuthManager, mockHttpClient, mockRateLimiter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Service Workflow', () => {
    it('should handle complete issue lifecycle workflow', async () => {
      // 1. Get current user
      mockHttpClient.get.mockResolvedValueOnce(mockUser);
      const currentUser = await jiraApiService.getCurrentUser();
      expect(currentUser).toEqual(mockUser);

      // 2. Get projects
      mockHttpClient.get.mockResolvedValueOnce([mockProject]);
      const projects = await jiraApiService.getProjects();
      expect(projects).toEqual([mockProject]);

      // 3. Create new issue
      const newIssueData = {
        fields: {
          project: { key: 'TEST' },
          summary: 'New Integration Test Issue',
          issuetype: { name: 'Story' }
        }
      };
      const createdIssue = { ...mockIssue, key: createIssueKey('TEST-124') };
      mockHttpClient.post.mockResolvedValueOnce(createdIssue);
      const newIssue = await jiraApiService.createIssue(newIssueData);
      expect(newIssue).toEqual(createdIssue);

      // 4. Get the created issue
      mockHttpClient.get.mockResolvedValueOnce(createdIssue);
      const retrievedIssue = await jiraApiService.getIssue(createdIssue.key);
      expect(retrievedIssue).toEqual(createdIssue);

      // 5. Get available transitions
      const mockTransitions: JiraTransition[] = [
        {
          id: '11',
          name: 'To Do',
          to: mockIssue.fields.status,
          hasScreen: false,
          isGlobal: true,
          isInitial: true,
          isAvailable: true,
          isConditional: false,
          isLooped: false
        }
      ];
      mockHttpClient.get.mockResolvedValueOnce({ transitions: mockTransitions });
      const transitions = await jiraApiService.getTransitions(createdIssue.key);
      expect(transitions).toEqual(mockTransitions);

      // 6. Transition the issue
      const transitionRequest: JiraTransitionRequest = {
        transition: { id: '11' }
      };
      mockHttpClient.post.mockResolvedValueOnce({});
      await jiraApiService.transitionIssue(createdIssue.key, transitionRequest);

      // 7. Update the issue
      const updateData = {
        fields: {
          summary: 'Updated Integration Test Issue'
        }
      };
      const updatedIssue = { ...createdIssue, fields: { ...createdIssue.fields, summary: 'Updated Integration Test Issue' } };
      mockHttpClient.put.mockResolvedValueOnce(updatedIssue);
      const result = await jiraApiService.updateIssue(createdIssue.key, updateData);
      expect(result).toEqual(updatedIssue);

      // Verify all HTTP calls were made
      expect(mockHttpClient.get).toHaveBeenCalledTimes(4); // current user, projects, get issue, transitions
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2); // create issue, transition
      expect(mockHttpClient.put).toHaveBeenCalledTimes(1); // update issue
    });

    it('should handle search and batch operations workflow', async () => {
      // 1. Search for issues
      const mockSearchResult: JiraSearchResult = {
        expand: 'names,schema',
        startAt: 0,
        maxResults: 50,
        total: 2,
        issues: [mockIssue, { ...mockIssue, key: createIssueKey('TEST-124') }]
      };
      mockHttpClient.get.mockResolvedValueOnce(mockSearchResult);
      
      const searchParams: JiraSearchParams = {
        jql: 'project = TEST AND status = "To Do"',
        startAt: 0,
        maxResults: 50
      };
      const searchResults = await jiraApiService.searchIssues(searchParams);
      expect(searchResults).toEqual(mockSearchResult);

      // 2. Batch get issues from search results
      const issueKeys = searchResults.issues.map(issue => issue.key);
      mockHttpClient.get
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce({ ...mockIssue, key: createIssueKey('TEST-124') });
      
      const batchResults = await jiraApiService.batchGetIssues(issueKeys);
      expect(batchResults).toHaveLength(2);
      expect(batchResults[0].result).toEqual(mockIssue);
      expect(batchResults[1].result).toEqual({ ...mockIssue, key: createIssueKey('TEST-124') });

      // 3. Batch update issues
      const issueUpdates = [
        { issueIdOrKey: issueKeys[0], updateData: { fields: { summary: 'Batch Updated 1' } } },
        { issueIdOrKey: issueKeys[1], updateData: { fields: { summary: 'Batch Updated 2' } } }
      ];
      mockHttpClient.put
        .mockResolvedValueOnce({ ...mockIssue, fields: { ...mockIssue.fields, summary: 'Batch Updated 1' } })
        .mockResolvedValueOnce({ ...mockIssue, key: createIssueKey('TEST-124'), fields: { ...mockIssue.fields, summary: 'Batch Updated 2' } });
      
      const updateResults = await jiraApiService.batchUpdateIssues(issueUpdates);
      expect(updateResults).toHaveLength(2);
      expect((updateResults[0].result as JiraIssue).fields.summary).toBe('Batch Updated 1');
      expect((updateResults[1].result as JiraIssue).fields.summary).toBe('Batch Updated 2');
    });

    it('should handle user search and project management workflow', async () => {
      // 1. Search for users
      const mockUsers = [mockUser, { ...mockUser, accountId: createUserId('user2'), displayName: 'Test User 2' }];
      mockHttpClient.get.mockResolvedValueOnce(mockUsers);
      
      const users = await jiraApiService.searchUsers('test');
      expect(users).toEqual(mockUsers);

      // 2. Get specific project
      mockHttpClient.get.mockResolvedValueOnce(mockProject);
      const project = await jiraApiService.getProject(mockProject.key);
      expect(project).toEqual(mockProject);

      // 3. Get project by ID
      mockHttpClient.get.mockResolvedValueOnce(mockProject);
      const projectById = await jiraApiService.getProject(mockProject.id);
      expect(projectById).toEqual(mockProject);
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should handle complete authentication workflow', async () => {
      // 1. Test connection
      const connectionResult = await jiraApiService.testConnection('test-password');
      expect(connectionResult).toEqual({ success: true, message: 'Connection successful' });
      expect(mockAuthManager.testConnection).toHaveBeenCalledWith('test-password');

      // 2. Get credentials
      const credentials = await jiraApiService.getCredentials('test-password');
      expect(credentials).toEqual(mockCredentials);
      expect(mockAuthManager.getStoredCredentials).toHaveBeenCalled();
      expect(mockAuthManager.decryptCredentials).toHaveBeenCalledWith(
        { encrypted: 'test', iv: 'test', salt: 'test' },
        'test-password'
      );

      // 3. Validate credentials
      const isValid = await jiraApiService.validateCredentials(mockCredentials);
      expect(isValid).toBe(true);
      expect(mockAuthManager.validateCredentials).toHaveBeenCalledWith(mockCredentials);

      // 4. Clear credentials
      await jiraApiService.clearCredentials();
      expect(mockAuthManager.clearCredentials).toHaveBeenCalled();
    });

    it('should handle authentication errors gracefully', async () => {
      // Mock authentication failure
      mockAuthManager.validateCredentials.mockResolvedValueOnce(false);
      
      const isValid = await jiraApiService.validateCredentials(mockCredentials);
      expect(isValid).toBe(false);

      // Mock connection test failure
      mockAuthManager.testConnection.mockResolvedValueOnce({ 
        success: false, 
        message: 'Invalid credentials' 
      });
      
      const connectionResult = await jiraApiService.testConnection('wrong-password');
      expect(connectionResult).toEqual({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    });
  });

  describe('Rate Limiting Under Load', () => {
    it('should handle multiple concurrent requests with rate limiting', async () => {
      // Mock rate limiter to allow first few requests then start limiting
      let callCount = 0;
      mockRateLimiter.acquireToken.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.resolve({ allowed: true, remaining: 100 - callCount });
        } else {
          return Promise.resolve({ 
            allowed: false, 
            remaining: 0, 
            retryAfter: 1000,
            error: 'RATE_LIMITED'
          });
        }
      });

      mockHttpClient.get.mockResolvedValue(mockIssue);

      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) => 
        jiraApiService.getIssue(createIssueKey(`TEST-${i + 1}`))
      );

      const results = await Promise.allSettled(promises);
      
      // First 5 should succeed, rest should fail with rate limit error
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(5);
      
      // Check that failed requests have rate limit error
      failed.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.type).toBe('RATE_LIMIT_ERROR');
        }
      });
    });

    it('should handle batch operations with rate limiting', async () => {
      // Mock rate limiter to allow requests but track calls
      let tokenCalls = 0;
      mockRateLimiter.acquireToken.mockImplementation(() => {
        tokenCalls++;
        return Promise.resolve({ allowed: true, remaining: 100 - tokenCalls });
      });

      mockHttpClient.put.mockResolvedValue(mockIssue);

      // Create batch update with many items
      const issueUpdates = Array.from({ length: 25 }, (_, i) => ({
        issueIdOrKey: createIssueKey(`TEST-${i + 1}`),
        updateData: { fields: { summary: `Updated ${i + 1}` } }
      }));

      const results = await jiraApiService.batchUpdateIssues(issueUpdates);
      
      expect(results).toHaveLength(25);
      expect(tokenCalls).toBe(25); // Should have called rate limiter for each request
    });
  });

  describe('Error Recovery and Retry Mechanisms', () => {
    it('should handle network errors and retries', async () => {
      // Mock network error first, then success
      const networkError = new Error('Network Error');
      mockHttpClient.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockIssue);

      // The HTTP client should handle retries internally
      // For this test, we'll just verify the error is propagated
      await expect(jiraApiService.getIssue(createIssueKey('TEST-123')))
        .rejects.toThrow('Network Error');
    });

    it('should handle API errors gracefully', async () => {
      // Mock 404 error - the HTTP client should transform this
      const transformedError = {
        type: 'JIRA_API_ERROR',
        status: 404,
        statusText: 'Not Found',
        message: 'Issue not found',
        errorMessages: ['Issue not found'],
        timestamp: expect.any(String)
      };
      mockHttpClient.get.mockRejectedValue(transformedError);

      await expect(jiraApiService.getIssue(createIssueKey('TEST-999')))
        .rejects.toMatchObject({
          type: 'JIRA_API_ERROR',
          status: 404
        });
    });

    it('should handle partial failures in batch operations', async () => {
      mockHttpClient.put
        .mockResolvedValueOnce(mockIssue)
        .mockRejectedValueOnce(new Error('Issue not found'))
        .mockResolvedValueOnce(mockIssue);

      const issueUpdates = [
        { issueIdOrKey: createIssueKey('TEST-123'), updateData: { fields: { summary: 'Updated 1' } } },
        { issueIdOrKey: createIssueKey('TEST-999'), updateData: { fields: { summary: 'Updated 2' } } },
        { issueIdOrKey: createIssueKey('TEST-124'), updateData: { fields: { summary: 'Updated 3' } } }
      ];

      const results = await jiraApiService.batchUpdateIssues(issueUpdates);
      
      expect(results).toHaveLength(3);
      expect(results[0].result).toEqual(mockIssue);
      expect(results[1].result).toBeInstanceOf(Error);
      expect(results[2].result).toEqual(mockIssue);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should properly clean up resources', () => {
      jiraApiService.destroy();
      
      expect(mockRateLimiter.destroy).toHaveBeenCalled();
      expect(jiraApiService['requestDeduplicationMap'].size).toBe(0);
    });

    it('should handle cleanup after errors', async () => {
      // Mock an error
      mockHttpClient.get.mockRejectedValue(new Error('Test error'));
      
      try {
        await jiraApiService.getIssue(createIssueKey('TEST-123'));
      } catch (error) {
        // Expected error
      }
      
      // Verify deduplication map is cleaned up even after error
      expect(jiraApiService['requestDeduplicationMap'].size).toBe(0);
    });
  });
});
