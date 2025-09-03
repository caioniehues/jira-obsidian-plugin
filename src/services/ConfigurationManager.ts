import { Plugin, Notice } from 'obsidian';
import { z } from 'zod';
import { EventEmitter } from 'events';
import type {
  PluginConfiguration,
  JiraCredentials,
  EncryptedCredentials,
  ConfigurationError,
  ConfigurationSaveOptions,
  ConnectionTestResult
} from './types';

/**
 * Configuration schema for runtime validation
 */
const PluginConfigurationSchema = z.object({
  version: z.string(),
  credentials: z.optional(z.object({
    encrypted: z.string(),
    iv: z.string(),
    salt: z.string()
  })),
  settings: z.object({
    cacheEnabled: z.boolean(),
    cacheTTL: z.number().min(0),
    rateLimit: z.object({
      requestsPerMinute: z.number().min(1).max(1000),
      burstLimit: z.number().min(1).max(1000)
    }),
    ui: z.object({
      theme: z.enum(['auto', 'light', 'dark']),
      defaultView: z.string(),
      refreshInterval: z.number().min(1000)
    })
  }),
  metadata: z.object({
    lastUpdated: z.string(),
    lastSync: z.string(),
    deviceId: z.string()
  })
});

/**
 * ConfigurationManager handles all configuration persistence for the plugin
 * Provides encrypted storage, migration, and synchronization capabilities
 */
export class ConfigurationManager extends EventEmitter {
  private plugin: Plugin;
  private configCache: PluginConfiguration | null = null;
  private encryptionKey: CryptoKey | null = null;
  private syncDebounceTimer: NodeJS.Timeout | null = null;

  constructor(plugin: Plugin) {
    super();
    this.plugin = plugin;
  }

  /**
   * Load configuration from plugin storage
   */
  async loadConfiguration(): Promise<PluginConfiguration> {
    try {
      const data = await this.plugin.loadData();
      
      if (!data) {
        return this.getDefaultConfiguration();
      }

      // Migrate if necessary
      const migrated = await this.migrate(data);
      
      // Validate configuration
      const validated = await this.validateConfiguration(migrated);
      
      this.configCache = validated;
      return validated;
    } catch (error) {
      const configError = this.createError('CFG001', 'Failed to load configuration', error);
      this.emit('error', configError);
      
      // Return default configuration on error
      return this.getDefaultConfiguration();
    }
  }

  /**
   * Save configuration to plugin storage
   */
  async saveConfiguration(
    config: PluginConfiguration,
    options: ConfigurationSaveOptions = {}
  ): Promise<void> {
    try {
      // Validate before saving
      const validated = await this.validateConfiguration(config);
      
      // Update timestamp
      validated.metadata.lastUpdated = new Date().toISOString();
      
      // Create backup if requested
      if (options.backup) {
        await this.createBackup(this.configCache || validated);
      }
      
      // Save to plugin storage
      await this.plugin.saveData(validated);
      
      // Update cache
      this.configCache = validated;
      
      // Sync to dashboard unless skipped
      if (!options.skipSync) {
        this.scheduleSyncToDashboard(validated);
      }
      
      // Emit change event
      this.emit('configuration-changed', {
        timestamp: validated.metadata.lastUpdated,
        changes: validated,
        source: 'plugin'
      });
    } catch (error) {
      const configError = this.createError('CFG002', 'Failed to save configuration', error);
      this.emit('error', configError);
      throw configError;
    }
  }

  /**
   * Update encrypted credentials
   */
  async updateCredentials(
    credentials: JiraCredentials,
    masterPassword: string
  ): Promise<void> {
    try {
      const encrypted = await this.encryptCredentials(credentials, masterPassword);
      const config = await this.loadConfiguration();
      
      config.credentials = encrypted;
      await this.saveConfiguration(config);
      
      // Emit credentials update event
      this.emit('credentials-updated', {
        timestamp: new Date().toISOString(),
        success: true,
        validated: false
      });
    } catch (error) {
      const configError = this.createError('CFG005', 'Failed to encrypt credentials', error);
      this.emit('error', configError);
      throw configError;
    }
  }

  /**
   * Validate connection with current credentials
   */
  async validateConnection(masterPassword: string): Promise<ConnectionTestResult> {
    try {
      const config = await this.loadConfiguration();
      
      if (!config.credentials) {
        return {
          success: false,
          message: 'No credentials configured'
        };
      }
      
      // Decrypt credentials
      const credentials = await this.decryptCredentials(config.credentials, masterPassword);
      
      // Test connection
      const response = await fetch(`${credentials.serverUrl}/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${btoa(`${credentials.email}:${credentials.apiToken}`)}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const user = await response.json();
        return {
          success: true,
          message: 'Connection successful',
          details: {
            accountId: user.accountId,
            displayName: user.displayName
          }
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${response.statusText}`
        };
      }
    } catch (error: any) {
      if (error.message?.includes('Decryption failed')) {
        return {
          success: false,
          message: 'Invalid master password'
        };
      }
      
      return {
        success: false,
        message: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Get default configuration
   */
  async getDefaultConfiguration(): Promise<PluginConfiguration> {
    return {
      version: '2.0.0',
      settings: {
        cacheEnabled: true,
        cacheTTL: 300000, // 5 minutes
        rateLimit: {
          requestsPerMinute: 100,
          burstLimit: 100
        },
        ui: {
          theme: 'auto',
          defaultView: 'dashboard',
          refreshInterval: 60000 // 1 minute
        }
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        deviceId: await this.generateDeviceId()
      }
    };
  }

  /**
   * Get crypto object (allows for testing)
   */
  private get crypto(): Crypto {
    // Check for various possible crypto locations
    // First check test environment
    if (typeof global !== 'undefined' && (global as any).crypto) {
      return (global as any).crypto;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto;
    }
    throw new Error('Crypto API not available');
  }

  /**
   * Encrypt credentials using AES-256-GCM
   */
  private async encryptCredentials(
    credentials: JiraCredentials,
    masterPassword: string
  ): Promise<EncryptedCredentials> {
    const crypto = this.crypto;
    if (!crypto?.subtle) {
      throw new Error('Crypto API not available');
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(credentials));
    
    // Generate salt for key derivation
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key from master password
    const key = await this.deriveKey(masterPassword, salt);
    
    // Generate IV for encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    return {
      encrypted: this.bufferToBase64(encrypted),
      iv: this.bufferToBase64(iv.buffer),
      salt: this.bufferToBase64(salt.buffer)
    };
  }

  /**
   * Decrypt credentials using AES-256-GCM
   */
  private async decryptCredentials(
    encryptedData: EncryptedCredentials,
    masterPassword: string
  ): Promise<JiraCredentials> {
    const crypto = this.crypto;
    if (!crypto?.subtle) {
      throw new Error('Crypto API not available');
    }
    
    const salt = new Uint8Array(this.base64ToBuffer(encryptedData.salt));
    const iv = new Uint8Array(this.base64ToBuffer(encryptedData.iv));
    const encrypted = this.base64ToBuffer(encryptedData.encrypted);
    
    // Derive key from master password
    const key = await this.deriveKey(masterPassword, salt);
    
    try {
      // Decrypt the data
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decrypted);
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Decryption failed. Invalid password or corrupted data.');
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const crypto = this.crypto;
    if (!crypto?.subtle) {
      throw new Error('Crypto API not available');
    }
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer.slice(0) as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Validate configuration against schema
   */
  private async validateConfiguration(config: any): Promise<PluginConfiguration> {
    try {
      return PluginConfigurationSchema.parse(config);
    } catch (error) {
      const configError = this.createError('CFG003', 'Configuration validation failed', error);
      throw configError;
    }
  }

  /**
   * Migrate configuration from older versions
   */
  private async migrate(data: any): Promise<PluginConfiguration> {
    try {
      // No version field means legacy format
      if (!data.version) {
        return this.migrateFromV0(data);
      }
      
      // Handle specific versions
      switch (data.version) {
        case '1.0.0':
          return this.migrateFromV1(data);
        case '2.0.0':
          return data; // Current version
        default:
          // Unknown version, attempt to use as-is
          return data;
      }
    } catch (error) {
      const configError = this.createError('CFG004', 'Configuration migration failed', error);
      this.emit('error', configError);
      
      // Return default configuration on migration failure
      return this.getDefaultConfiguration();
    }
  }

  /**
   * Migrate from legacy format (no version)
   */
  private async migrateFromV0(data: any): Promise<PluginConfiguration> {
    await this.createBackup(data);
    
    return {
      version: '2.0.0',
      credentials: data.jiraCredentials,
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
        lastUpdated: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        deviceId: await this.generateDeviceId()
      }
    };
  }

  /**
   * Migrate from version 1.0.0
   */
  private async migrateFromV1(data: any): Promise<PluginConfiguration> {
    await this.createBackup(data);
    
    return {
      version: '2.0.0',
      credentials: data.encryptedCredentials,
      settings: data.settings || {
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
        lastUpdated: new Date().toISOString(),
        lastSync: data.lastSync || new Date().toISOString(),
        deviceId: data.deviceId || await this.generateDeviceId()
      }
    };
  }

  /**
   * Create backup of configuration
   */
  private async createBackup(config: any): Promise<void> {
    const backupKey = `backup_${Date.now()}`;
    const backups = (await this.plugin.loadData())?.backups || {};
    
    // Keep only last 3 backups
    const backupKeys = Object.keys(backups).sort();
    if (backupKeys.length >= 3) {
      delete backups[backupKeys[0]];
    }
    
    backups[backupKey] = config;
    
    await this.plugin.saveData({
      ...await this.plugin.loadData(),
      backups
    });
  }

  /**
   * Schedule sync to dashboard with debouncing
   */
  private scheduleSyncToDashboard(config: PluginConfiguration): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToDashboard(config);
    }, 500);
  }

  /**
   * Sync configuration to dashboard
   */
  private async syncToDashboard(config: PluginConfiguration): Promise<void> {
    try {
      config.metadata.lastSync = new Date().toISOString();
      
      // Trigger Obsidian event for dashboard to pick up
      (this.plugin.app.workspace as any).trigger('jira-dashboard:config-changed', {
        timestamp: config.metadata.lastSync,
        changes: config,
        source: 'plugin'
      });
    } catch (error) {
      const configError = this.createError('CFG007', 'Configuration sync failed', error);
      this.emit('error', configError);
    }
  }

  /**
   * Generate device fingerprint
   */
  private async generateDeviceId(): Promise<string> {
    try {
      const info = [
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        typeof screen !== 'undefined' ? screen.width : 1920,
        typeof screen !== 'undefined' ? screen.height : 1080,
        typeof screen !== 'undefined' ? screen.colorDepth : 24,
        new Date().getTimezoneOffset()
      ].join('|');
      
      const encoder = new TextEncoder();
      const data = encoder.encode(info);
      const hash = await this.crypto.subtle.digest('SHA-256', data);
      return this.bufferToBase64(hash);
    } catch (error) {
      // Fallback to a simple device ID if crypto is not available
      // This ensures tests and environments without crypto still work
      return 'device-' + Math.random().toString(36).substring(2, 15);
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Create standardized error
   */
  createError(code: string, message: string, cause?: any): ConfigurationError {
    return {
      code,
      message: `${message}${cause ? `: ${cause.message || cause}` : ''}`,
      timestamp: new Date().toISOString(),
      details: cause
    };
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.configCache = null;
    this.encryptionKey = null;
  }

  /**
   * Destroy manager and clean up resources
   */
  destroy(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.clearCache();
    this.removeAllListeners();
  }
}