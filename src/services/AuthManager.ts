import { Plugin } from 'obsidian';

export interface JiraCredentials {
  email: string;
  apiToken: string;
  serverUrl: string;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}

export class AuthManager {
  private plugin: Plugin;
  private encryptionKey: CryptoKey | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Encrypt credentials using AES-256-GCM
   */
  async encryptCredentials(credentials: JiraCredentials, masterPassword: string): Promise<EncryptedData> {
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
  async decryptCredentials(encryptedData: EncryptedData, masterPassword: string): Promise<JiraCredentials> {
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
      throw new Error('Failed to decrypt credentials. Invalid password or corrupted data.');
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
        salt: salt as unknown as ArrayBuffer,
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
   * Validate credentials against Jira API
   */
  async validateCredentials(credentials: JiraCredentials): Promise<boolean> {
    const { email, apiToken, serverUrl } = credentials;
    
    try {
      const response = await fetch(`${serverUrl}/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${btoa(`${email}:${apiToken}`)}`,
          'Accept': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to validate credentials:', error);
      return false;
    }
  }

  /**
   * Store encrypted credentials in plugin settings
   */
  async storeCredentials(encryptedData: EncryptedData): Promise<void> {
    await this.plugin.saveData({
      ...await this.plugin.loadData(),
      jiraCredentials: encryptedData
    });
  }

  /**
   * Retrieve encrypted credentials from plugin settings
   */
  async getStoredCredentials(): Promise<EncryptedData | null> {
    const data = await this.plugin.loadData();
    return data?.jiraCredentials || null;
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<void> {
    const data = await this.plugin.loadData();
    delete data.jiraCredentials;
    await this.plugin.saveData(data);
    
    // Clear encryption key from memory
    this.encryptionKey = null;
  }

  /**
   * Generate device fingerprint for additional security
   */
  async getDeviceFingerprint(): Promise<string> {
    const info = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(info);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.bufferToBase64(hash);
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
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
   * Test connection with stored credentials
   */
  async testConnection(masterPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const encryptedData = await this.getStoredCredentials();
      if (!encryptedData) {
        return { success: false, message: 'No credentials stored' };
      }
      
      const credentials = await this.decryptCredentials(encryptedData, masterPassword);
      const isValid = await this.validateCredentials(credentials);
      
      if (isValid) {
        return { success: true, message: 'Connection successful' };
      } else {
        return { success: false, message: 'Invalid credentials or server unreachable' };
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}