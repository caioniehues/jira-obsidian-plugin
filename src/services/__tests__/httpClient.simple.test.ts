import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HttpClient } from '../httpClient';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(),
  isAxiosError: jest.fn()
}));

describe('HttpClient - Simple Tests', () => {
  let httpClient: HttpClient;
  let mockAxiosInstance: any;
  const mockAxios = require('axios');

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      },
      defaults: {
        baseURL: '',
        timeout: 5000,
        auth: {}
      }
    };

    mockAxios.create.mockReturnValue(mockAxiosInstance);
    mockAxios.isAxiosError.mockImplementation((error: any) => error.isAxiosError === true);

    httpClient = new HttpClient({
      baseUrl: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token',
      timeout: 5000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.atlassian.net',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        auth: {
          username: 'test@example.com',
          password: 'test-token'
        }
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET requests', async () => {
      const mockResponse = { data: { id: '123', name: 'Test' } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await httpClient.get('/test-endpoint');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/test-endpoint',
        data: undefined,
        headers: undefined,
        timeout: undefined
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should make POST requests with data', async () => {
      const mockResponse = { data: { id: '123', created: true } };
      const requestData = { name: 'Test Item' };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await httpClient.post('/test-endpoint', requestData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/test-endpoint',
        data: requestData,
        headers: undefined,
        timeout: undefined
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
        isAxiosError: true
      };
      mockAxiosInstance.request.mockRejectedValue(networkError);

      await expect(httpClient.get('/test-endpoint')).rejects.toMatchObject({
        type: 'NETWORK_ERROR',
        message: expect.stringContaining('Network Error')
      });
    });

    it('should handle 401 authentication errors', async () => {
      const authError = {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { errorMessages: ['Invalid credentials'] }
        },
        isAxiosError: true
      };
      mockAxiosInstance.request.mockRejectedValue(authError);

      await expect(httpClient.get('/test-endpoint')).rejects.toMatchObject({
        type: 'AUTHENTICATION_ERROR',
        status: 401,
        message: expect.stringContaining('Invalid credentials')
      });
    });

    it('should handle 4xx API errors', async () => {
      const apiError = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { 
            errorMessages: ['Invalid request'],
            errors: { field: 'This field is required' }
          }
        },
        isAxiosError: true
      };
      mockAxiosInstance.request.mockRejectedValue(apiError);

      await expect(httpClient.get('/test-endpoint')).rejects.toMatchObject({
        type: 'JIRA_API_ERROR',
        status: 400,
        message: expect.stringContaining('Invalid request')
      });
    });
  });

  describe('Configuration', () => {
    it('should get current configuration', () => {
      const config = httpClient.getConfig();
      expect(config.baseUrl).toBe('https://test.atlassian.net');
      expect(config.email).toBe('test@example.com');
      expect(config.apiToken).toBe('test-token');
      expect(config.timeout).toBe(5000);
      expect(config.maxRetries).toBe(3);
    });

    it('should update configuration', () => {
      httpClient.updateConfig({
        timeout: 10000,
        maxRetries: 5
      });

      const config = httpClient.getConfig();
      expect(config.timeout).toBe(10000);
      expect(config.maxRetries).toBe(5);
    });
  });
});
