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

describe('JiraApiService', () => {
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
      getConfig: jest.fn().mockReturnValue({
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        timeout: 5000,
        maxRetries: 3
      }),
      updateConfig: jest.fn()
    } as any;

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

  describe('Initialization', () => {
    it('should initialize with AuthManager, HttpClient, and RateLimiter', () => {
      expect(jiraApiService).toBeInstanceOf(JiraApiService);
    });

    it('should have request deduplication map initialized', () => {
      expect(jiraApiService['requestDeduplicationMap']).toBeDefined();
      expect(jiraApiService['requestDeduplicationMap'].size).toBe(0);
    });
  });

  describe('Authentication Integration', () => {
    it('should get credentials from AuthManager', async () => {
      const credentials = await jiraApiService.getCredentials('test-password');
      
      expect(mockAuthManager.getStoredCredentials).toHaveBeenCalled();
      expect(mockAuthManager.decryptCredentials).toHaveBeenCalledWith(
        { encrypted: 'test', iv: 'test', salt: 'test' },
        'test-password'
      );
      expect(credentials).toEqual(mockCredentials);
    });

    it('should validate credentials through AuthManager', async () => {
      const isValid = await jiraApiService.validateCredentials(mockCredentials);
      
      expect(mockAuthManager.validateCredentials).toHaveBeenCalledWith(mockCredentials);
      expect(isValid).toBe(true);
    });

    it('should clear credentials through AuthManager', async () => {
      await jiraApiService.clearCredentials();
      
      expect(mockAuthManager.clearCredentials).toHaveBeenCalled();
    });

    it('should test connection through AuthManager', async () => {
      const result = await jiraApiService.testConnection('test-password');
      
      expect(mockAuthManager.testConnection).toHaveBeenCalledWith('test-password');
      expect(result).toEqual({ success: true, message: 'Connection successful' });
    });
  });

  describe('Issue Operations', () => {
    it('should get issue by key', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      const result = await jiraApiService.getIssue(createIssueKey('TEST-123'));

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/issue/TEST-123');
      expect(result).toEqual(mockIssue);
    });

    it('should get issue by ID', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      const result = await jiraApiService.getIssue('10001');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/issue/10001');
      expect(result).toEqual(mockIssue);
    });

    it('should create issue', async () => {
      const issueData = {
        fields: {
          project: { key: 'TEST' },
          summary: 'New Issue',
          issuetype: { name: 'Story' }
        }
      };
      const createdIssue = { ...mockIssue, key: createIssueKey('TEST-124') };
      mockHttpClient.post.mockResolvedValue(createdIssue);

      const result = await jiraApiService.createIssue(issueData);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/rest/api/3/issue', issueData);
      expect(result).toEqual(createdIssue);
    });

    it('should update issue', async () => {
      const updateData = {
        fields: {
          summary: 'Updated Issue'
        }
      };
      mockHttpClient.put.mockResolvedValue(mockIssue);

      const result = await jiraApiService.updateIssue(createIssueKey('TEST-123'), updateData);

      expect(mockHttpClient.put).toHaveBeenCalledWith('/rest/api/3/issue/TEST-123', updateData);
      expect(result).toEqual(mockIssue);
    });

    it('should get available transitions for issue', async () => {
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
      mockHttpClient.get.mockResolvedValue({ transitions: mockTransitions });

      const result = await jiraApiService.getTransitions(createIssueKey('TEST-123'));

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/issue/TEST-123/transitions');
      expect(result).toEqual(mockTransitions);
    });

    it('should transition issue', async () => {
      const transitionRequest: JiraTransitionRequest = {
        transition: { id: '11' }
      };
      mockHttpClient.post.mockResolvedValue({});

      await jiraApiService.transitionIssue(createIssueKey('TEST-123'), transitionRequest);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/rest/api/3/issue/TEST-123/transitions', transitionRequest);
    });
  });

  describe('Project Operations', () => {
    it('should get all projects', async () => {
      const mockProjects = [mockProject];
      mockHttpClient.get.mockResolvedValue(mockProjects);

      const result = await jiraApiService.getProjects();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/project');
      expect(result).toEqual(mockProjects);
    });

    it('should get project by key', async () => {
      mockHttpClient.get.mockResolvedValue(mockProject);

      const result = await jiraApiService.getProject(createProjectKey('TEST'));

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/project/TEST');
      expect(result).toEqual(mockProject);
    });

    it('should get project by ID', async () => {
      mockHttpClient.get.mockResolvedValue(mockProject);

      const result = await jiraApiService.getProject('10000');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/project/10000');
      expect(result).toEqual(mockProject);
    });
  });

  describe('User Operations', () => {
    it('should get current user', async () => {
      mockHttpClient.get.mockResolvedValue(mockUser);

      const result = await jiraApiService.getCurrentUser();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/myself');
      expect(result).toEqual(mockUser);
    });

    it('should search users', async () => {
      const mockUsers = [mockUser];
      mockHttpClient.get.mockResolvedValue(mockUsers);

      const result = await jiraApiService.searchUsers('test');

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/user/search', {
        params: { query: 'test' }
      });
      expect(result).toEqual(mockUsers);
    });

    it('should search users with maxResults', async () => {
      const mockUsers = [mockUser];
      mockHttpClient.get.mockResolvedValue(mockUsers);

      const result = await jiraApiService.searchUsers('test', 10);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/user/search', {
        params: { query: 'test', maxResults: 10 }
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('Search Operations', () => {
    it('should search issues with JQL', async () => {
      const mockSearchResult: JiraSearchResult = {
        expand: 'names,schema',
        startAt: 0,
        maxResults: 50,
        total: 1,
        issues: [mockIssue]
      };
      mockHttpClient.get.mockResolvedValue(mockSearchResult);

      const searchParams: JiraSearchParams = {
        jql: 'project = TEST',
        startAt: 0,
        maxResults: 50
      };

      const result = await jiraApiService.searchIssues(searchParams);

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/search', {
        params: searchParams
      });
      expect(result).toEqual(mockSearchResult);
    });

    it('should search issues with default parameters', async () => {
      const mockSearchResult: JiraSearchResult = {
        expand: 'names,schema',
        startAt: 0,
        maxResults: 50,
        total: 1,
        issues: [mockIssue]
      };
      mockHttpClient.get.mockResolvedValue(mockSearchResult);

      const result = await jiraApiService.searchIssues({ jql: 'project = TEST' });

      expect(mockHttpClient.get).toHaveBeenCalledWith('/rest/api/3/search', {
        params: {
          jql: 'project = TEST',
          startAt: 0,
          maxResults: 50
        }
      });
      expect(result).toEqual(mockSearchResult);
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      // Make two identical requests simultaneously
      const promise1 = jiraApiService.getIssue(createIssueKey('TEST-123'));
      const promise2 = jiraApiService.getIssue(createIssueKey('TEST-123'));

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should only make one HTTP request
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockIssue);
      expect(result2).toEqual(mockIssue);
    });

    it('should not deduplicate different requests', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      await jiraApiService.getIssue(createIssueKey('TEST-123'));
      await jiraApiService.getIssue(createIssueKey('TEST-124'));

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should clear deduplication map after request completion', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      await jiraApiService.getIssue(createIssueKey('TEST-123'));

      // Map should be empty after request completion
      expect(jiraApiService['requestDeduplicationMap'].size).toBe(0);
    });
  });

  describe('Performance Optimizations', () => {
    it('should apply rate limiting to requests', async () => {
      mockHttpClient.get.mockResolvedValue(mockIssue);

      await jiraApiService.getIssue(createIssueKey('TEST-123'));

      expect(mockRateLimiter.acquireToken).toHaveBeenCalled();
    });

    it('should handle rate limit exceeded', async () => {
      mockRateLimiter.acquireToken.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfter: 1000,
        error: 'RATE_LIMITED'
      });

      await expect(jiraApiService.getIssue(createIssueKey('TEST-123')))
        .rejects.toMatchObject({
          type: 'RATE_LIMIT_ERROR'
        });
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on destroy', () => {
      jiraApiService.destroy();

      expect(mockRateLimiter.destroy).toHaveBeenCalled();
    });

    it('should clear deduplication map on destroy', () => {
      // Add some entries to the map
      jiraApiService['requestDeduplicationMap'].set('test-key', Promise.resolve({}));
      
      jiraApiService.destroy();

      expect(jiraApiService['requestDeduplicationMap'].size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should propagate HTTP client errors', async () => {
      const error = new Error('Network error');
      mockHttpClient.get.mockRejectedValue(error);

      await expect(jiraApiService.getIssue(createIssueKey('TEST-123')))
        .rejects.toThrow('Network error');
    });

    it('should handle authentication errors', async () => {
      const authError = {
        type: 'AUTHENTICATION_ERROR',
        message: 'Invalid credentials',
        status: 401,
        timestamp: new Date().toISOString()
      };
      mockHttpClient.get.mockRejectedValue(authError);

      await expect(jiraApiService.getIssue(createIssueKey('TEST-123')))
        .rejects.toMatchObject({
          type: 'AUTHENTICATION_ERROR'
        });
    });
  });

  describe('Batch Operations', () => {
    it('should batch update multiple issues', async () => {
      const issueUpdates = [
        { issueIdOrKey: createIssueKey('TEST-123'), updateData: { fields: { summary: 'Updated 1' } } },
        { issueIdOrKey: createIssueKey('TEST-124'), updateData: { fields: { summary: 'Updated 2' } } }
      ];
      
      mockHttpClient.put.mockResolvedValue(mockIssue);

      const results = await jiraApiService.batchUpdateIssues(issueUpdates);

      expect(results).toHaveLength(2);
      expect(results[0].issueIdOrKey).toBe('TEST-123');
      expect(results[0].result).toEqual(mockIssue);
      expect(results[1].issueIdOrKey).toBe('TEST-124');
      expect(results[1].result).toEqual(mockIssue);
    });

    it('should handle errors in batch update', async () => {
      const issueUpdates = [
        { issueIdOrKey: createIssueKey('TEST-123'), updateData: { fields: { summary: 'Updated 1' } } },
        { issueIdOrKey: createIssueKey('TEST-999'), updateData: { fields: { summary: 'Updated 2' } } }
      ];
      
      mockHttpClient.put
        .mockResolvedValueOnce(mockIssue)
        .mockRejectedValueOnce(new Error('Issue not found'));

      const results = await jiraApiService.batchUpdateIssues(issueUpdates);

      expect(results).toHaveLength(2);
      expect(results[0].result).toEqual(mockIssue);
      expect(results[1].result).toBeInstanceOf(Error);
    });

    it('should batch get multiple issues', async () => {
      const issueIds = [createIssueKey('TEST-123'), createIssueKey('TEST-124')];
      
      mockHttpClient.get.mockResolvedValue(mockIssue);

      const results = await jiraApiService.batchGetIssues(issueIds);

      expect(results).toHaveLength(2);
      expect(results[0].issueIdOrKey).toBe('TEST-123');
      expect(results[0].result).toEqual(mockIssue);
      expect(results[1].issueIdOrKey).toBe('TEST-124');
      expect(results[1].result).toEqual(mockIssue);
    });

    it('should batch transition multiple issues', async () => {
      const transitions = [
        { 
          issueIdOrKey: createIssueKey('TEST-123'), 
          transitionRequest: { transition: { id: '11' } } 
        },
        { 
          issueIdOrKey: createIssueKey('TEST-124'), 
          transitionRequest: { transition: { id: '21' } } 
        }
      ];
      
      mockHttpClient.post.mockResolvedValue({});

      const results = await jiraApiService.batchTransitionIssues(transitions);

      expect(results).toHaveLength(2);
      expect(results[0].issueIdOrKey).toBe('TEST-123');
      expect(results[0].result).toBeUndefined();
      expect(results[1].issueIdOrKey).toBe('TEST-124');
      expect(results[1].result).toBeUndefined();
    });

    it('should respect rate limits in batch operations', async () => {
      const issueUpdates = Array.from({ length: 25 }, (_, i) => ({
        issueIdOrKey: createIssueKey(`TEST-${i + 1}`),
        updateData: { fields: { summary: `Updated ${i + 1}` } }
      }));
      
      mockHttpClient.put.mockResolvedValue(mockIssue);

      const results = await jiraApiService.batchUpdateIssues(issueUpdates);

      expect(results).toHaveLength(25);
      // Should have been called multiple times due to batching
      expect(mockRateLimiter.acquireToken).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should get HTTP client configuration', () => {
      const config = jiraApiService.getConfig();

      expect(mockHttpClient.getConfig).toHaveBeenCalled();
      expect(config).toEqual({
        baseUrl: 'https://test.atlassian.net',
        email: 'test@example.com',
        apiToken: 'test-token',
        timeout: 5000,
        maxRetries: 3
      });
    });

    it('should update HTTP client configuration', () => {
      const newConfig = { timeout: 10000, maxRetries: 5 };

      jiraApiService.updateConfig(newConfig);

      expect(mockHttpClient.updateConfig).toHaveBeenCalledWith(newConfig);
    });
  });
});
