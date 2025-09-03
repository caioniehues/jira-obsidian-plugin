import { Plugin } from 'obsidian';
import { ConfigurationManager } from '../ConfigurationManager';
import type { PluginConfiguration, EncryptedCredentials, JiraCredentials } from '../types';

// Mock Obsidian Plugin
const mockLoadData = jest.fn();
const mockSaveData = jest.fn();

const mockPlugin = {
  loadData: mockLoadData,
  saveData: mockSaveData,
  manifest: { version: '2.0.0' }
} as unknown as Plugin;

// Mock crypto functions - create a complete mock that matches Crypto interface
const mockSubtle = {
  encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  decrypt: jest.fn(),
  importKey: jest.fn().mockResolvedValue('mock-key'),
  deriveKey: jest.fn().mockResolvedValue('mock-derived-key'),
  digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
};

const mockGetRandomValues = jest.fn((arr: Uint8Array) => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
});

const mockCrypto = {
  getRandomValues: mockGetRandomValues,
  subtle: mockSubtle
} as unknown as Crypto;

// Replace crypto on all possible locations for tests  
(global as any).crypto = mockCrypto;
(globalThis as any).crypto = mockCrypto;
if (typeof window !== 'undefined') {
  (window as any).crypto = mockCrypto;
}

// Add TextEncoder/TextDecoder polyfills for Jest
(global as any).TextEncoder = class TextEncoder {
  encode(str: string): Uint8Array {
    const buf = Buffer.from(str, 'utf-8');
    const arr = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      arr[i] = buf[i];
    }
    return arr;
  }
};

(global as any).TextDecoder = class TextDecoder {
  decode(arr: Uint8Array): string {
    return Buffer.from(arr).toString('utf-8');
  }
};

// Add btoa/atob polyfills for Jest
(global as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
(global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Mock browser APIs for device fingerprinting
(global as any).navigator = {
  userAgent: 'Mozilla/5.0 (Test Environment)',
  language: 'en-US'
};

(global as any).screen = {
  width: 1920,
  height: 1080,
  colorDepth: 24
};

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all crypto mock functions
    mockGetRandomValues.mockClear();
    mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    mockSubtle.decrypt.mockClear();
    mockSubtle.importKey.mockResolvedValue('mock-key');
    mockSubtle.deriveKey.mockResolvedValue('mock-derived-key');
    mockSubtle.digest.mockResolvedValue(new ArrayBuffer(32));
    
    // Ensure crypto mock is set up properly on all locations
    (global as any).crypto = mockCrypto;
    (globalThis as any).crypto = mockCrypto;
    if (typeof window !== 'undefined') {
      (window as any).crypto = mockCrypto;
    }
    
    configManager = new ConfigurationManager(mockPlugin);
  });

  describe('loadConfiguration', () => {
    it('should return default configuration when no data exists', async () => {
      mockLoadData.mockResolvedValue(null);

      const config = await configManager.loadConfiguration();

      expect(config).toBeDefined();
      expect(config.version).toBe('2.0.0');
      expect(config.settings.cacheEnabled).toBe(true);
      expect(config.settings.cacheTTL).toBe(300000);
      expect(config.settings.rateLimit.requestsPerMinute).toBe(100);
    });

    it('should load and validate existing configuration', async () => {
      const existingConfig: PluginConfiguration = {
        version: '2.0.0',
        settings: {
          cacheEnabled: false,
          cacheTTL: 600000,
          rateLimit: {
            requestsPerMinute: 50,
            burstLimit: 50
          },
          ui: {
            theme: 'dark',
            defaultView: 'kanban',
            refreshInterval: 30000
          }
        },
        metadata: {
          lastUpdated: '2024-01-01T00:00:00Z',
          lastSync: '2024-01-01T00:00:00Z',
          deviceId: 'test-device-123'
        }
      };

      mockLoadData.mockResolvedValue(existingConfig);

      const config = await configManager.loadConfiguration();

      expect(config).toEqual(existingConfig);
      expect(mockLoadData).toHaveBeenCalledTimes(1);
    });

    it('should migrate legacy configuration format', async () => {
      const legacyConfig = {
        jiraCredentials: {
          encrypted: 'legacy-encrypted-data',
          iv: 'legacy-iv',
          salt: 'legacy-salt'
        }
      };

      mockLoadData.mockResolvedValue(legacyConfig);

      const config = await configManager.loadConfiguration();

      expect(config.version).toBe('2.0.0');
      expect(config.credentials).toEqual(legacyConfig.jiraCredentials);
      expect(config.settings).toBeDefined();
      expect(config.metadata).toBeDefined();
    });

    it('should handle corrupted configuration gracefully', async () => {
      mockLoadData.mockResolvedValue({ invalid: 'data' });

      const config = await configManager.loadConfiguration();

      expect(config.version).toBe('2.0.0');
      expect(config.settings).toBeDefined();
    });
  });

  describe('saveConfiguration', () => {
    it('should save configuration with updated timestamp', async () => {
      const config: PluginConfiguration = {
        version: '2.0.0',
        settings: {
          cacheEnabled: true,
          cacheTTL: 300000,
          rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 100
          },
          ui: {
            theme: 'auto',
            defaultView: 'dashboard',
            refreshInterval: 60000
          }
        },
        metadata: {
          lastUpdated: '2024-01-01T00:00:00Z',
          lastSync: '2024-01-01T00:00:00Z',
          deviceId: 'test-device'
        }
      };

      await configManager.saveConfiguration(config);

      expect(mockSaveData).toHaveBeenCalledTimes(1);
      const savedConfig = mockSaveData.mock.calls[0][0];
      expect(savedConfig.metadata.lastUpdated).not.toBe('2024-01-01T00:00:00Z');
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        version: '2.0.0',
        settings: {
          cacheEnabled: 'invalid', // Should be boolean
          cacheTTL: 300000,
          rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 100
          }
        }
      } as any;

      await expect(configManager.saveConfiguration(invalidConfig)).rejects.toThrow();
      expect(mockSaveData).not.toHaveBeenCalled();
    });

    it('should skip sync when option is provided', async () => {
      const config = await configManager.getDefaultConfiguration();
      const syncSpy = jest.spyOn(configManager as any, 'syncToDashboard');

      await configManager.saveConfiguration(config, { skipSync: true });

      expect(mockSaveData).toHaveBeenCalled();
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  describe('updateCredentials', () => {
    beforeEach(() => {
      // Ensure crypto mock is available for these tests
      (global as any).crypto = mockCrypto;
      (globalThis as any).crypto = mockCrypto;
      
      mockSubtle.importKey.mockResolvedValue('mock-key');
      mockSubtle.deriveKey.mockResolvedValue('mock-derived-key');
      mockSubtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should encrypt and save credentials', async () => {
      const credentials: JiraCredentials = {
        email: 'test@example.com',
        apiToken: 'test-token',
        serverUrl: 'https://test.atlassian.net'
      };

      mockLoadData.mockResolvedValue(null);
      
      // Debug: check if mock is properly set
      console.log('global.crypto:', (global as any).crypto);
      console.log('global.crypto.subtle:', (global as any).crypto?.subtle);

      await configManager.updateCredentials(credentials, 'master-password');

      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
      expect(mockSaveData).toHaveBeenCalled();
      
      const savedConfig = mockSaveData.mock.calls[0][0];
      expect(savedConfig.credentials).toBeDefined();
      expect(savedConfig.credentials.encrypted).toBeDefined();
      expect(savedConfig.credentials.iv).toBeDefined();
      expect(savedConfig.credentials.salt).toBeDefined();
    });

    it('should handle encryption errors gracefully', async () => {
      mockSubtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

      const credentials: JiraCredentials = {
        email: 'test@example.com',
        apiToken: 'test-token',
        serverUrl: 'https://test.atlassian.net'
      };

      await expect(
        configManager.updateCredentials(credentials, 'password')
      ).rejects.toThrow('Failed to encrypt credentials');
    });
  });

  describe('validateConnection', () => {
    beforeEach(() => {
      // Ensure crypto mock is available for these tests
      (global as any).crypto = mockCrypto;
      (globalThis as any).crypto = mockCrypto;
      
      mockSubtle.importKey.mockResolvedValue('mock-key');
      mockSubtle.deriveKey.mockResolvedValue('mock-derived-key');
      mockSubtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({
          email: 'test@example.com',
          apiToken: 'test-token',
          serverUrl: 'https://test.atlassian.net'
        }))
      );
    });

    it('should validate connection with correct password', async () => {
      const config: PluginConfiguration = {
        version: '2.0.0',
        credentials: {
          encrypted: 'encrypted-data',
          iv: 'iv-data',
          salt: 'salt-data'
        },
        settings: {
          cacheEnabled: true,
          cacheTTL: 300000,
          rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 100
          },
          ui: {
            theme: 'auto',
            defaultView: 'dashboard',
            refreshInterval: 60000
          }
        },
        metadata: {
          lastUpdated: '2024-01-01T00:00:00Z',
          lastSync: '2024-01-01T00:00:00Z',
          deviceId: 'test-device'
        }
      };

      mockLoadData.mockResolvedValue(config);

      // Mock fetch for connection test
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accountId: 'test-user' })
      });

      const result = await configManager.validateConnection('master-password');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connection successful');
    });

    it('should fail validation with incorrect password', async () => {
      mockSubtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      const config: PluginConfiguration = {
        version: '2.0.0',
        credentials: {
          encrypted: 'encrypted-data',
          iv: 'iv-data',
          salt: 'salt-data'
        },
        settings: {
          cacheEnabled: true,
          cacheTTL: 300000,
          rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 100
          },
          ui: {
            theme: 'auto',
            defaultView: 'dashboard',
            refreshInterval: 60000
          }
        },
        metadata: {
          lastUpdated: '2024-01-01T00:00:00Z',
          lastSync: '2024-01-01T00:00:00Z',
          deviceId: 'test-device'
        }
      };

      mockLoadData.mockResolvedValue(config);

      const result = await configManager.validateConnection('wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid master password');
    });

    it('should handle missing credentials', async () => {
      mockLoadData.mockResolvedValue({
        version: '2.0.0',
        settings: {
          cacheEnabled: true,
          cacheTTL: 300000,
          rateLimit: {
            requestsPerMinute: 100,
            burstLimit: 100
          },
          ui: {
            theme: 'auto',
            defaultView: 'dashboard',
            refreshInterval: 60000
          }
        },
        metadata: {
          lastUpdated: '2024-01-01T00:00:00Z',
          lastSync: '2024-01-01T00:00:00Z',
          deviceId: 'test-device'
        }
      });

      const result = await configManager.validateConnection('password');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No credentials configured');
    });
  });

  describe('migration', () => {
    it('should migrate from v1.0.0 to v2.0.0', async () => {
      const v1Config = {
        version: '1.0.0',
        email: 'test@example.com',
        serverUrl: 'https://test.atlassian.net',
        encryptedToken: 'old-encrypted-token'
      };

      mockLoadData.mockResolvedValue(v1Config);

      const config = await configManager.loadConfiguration();

      expect(config.version).toBe('2.0.0');
      expect(config.settings).toBeDefined();
      expect(config.metadata).toBeDefined();
    });

    it('should create backup before migration', async () => {
      const oldConfig = {
        version: '1.0.0',
        data: 'old-data'
      };

      mockLoadData.mockResolvedValue(oldConfig);
      
      const backupSpy = jest.spyOn(configManager as any, 'createBackup');

      await configManager.loadConfiguration();

      expect(backupSpy).toHaveBeenCalledWith(oldConfig);
    });
  });

  describe('error handling', () => {
    it('should emit error events on failure', async () => {
      mockSaveData.mockRejectedValue(new Error('Storage error'));

      const errorHandler = jest.fn();
      configManager.on('error', errorHandler);

      const config = await configManager.getDefaultConfiguration();
      
      try {
        await configManager.saveConfiguration(config);
      } catch (e) {
        // Expected to throw
      }

      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        code: 'CFG002',
        message: expect.stringContaining('Storage error')
      }));
    });

    it('should provide detailed error codes', async () => {
      const testCases = [
        { error: 'Storage read failed', code: 'CFG001' },
        { error: 'Storage write failed', code: 'CFG002' },
        { error: 'Validation failed', code: 'CFG003' },
        { error: 'Migration failed', code: 'CFG004' },
        { error: 'Encryption failed', code: 'CFG005' },
        { error: 'Decryption failed', code: 'CFG006' }
      ];

      for (const testCase of testCases) {
        const error = configManager.createError(testCase.code, testCase.error);
        expect(error.code).toBe(testCase.code);
        expect(error.message).toContain(testCase.error);
      }
    });
  });
});