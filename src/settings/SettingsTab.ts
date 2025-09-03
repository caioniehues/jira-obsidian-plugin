import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import JiraDashboardPlugin from '../main';
import { JiraCredentials } from '../services/AuthManager';

interface PluginSettings {
  serverUrl: string;
  email: string;
  apiToken: string;
  masterPassword: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
  serverUrl: 'https://yourcompany.atlassian.net',
  email: '',
  apiToken: '',
  masterPassword: ''
};

export class JiraSettingsTab extends PluginSettingTab {
  plugin: JiraDashboardPlugin;
  private settings: PluginSettings;
  private isTestingConnection = false;
  private currentFormData: Partial<PluginSettings> = {};
  private settingsContainer: HTMLElement | null = null;

  constructor(app: App, plugin: JiraDashboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settings = DEFAULT_SETTINGS;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Title
    containerEl.createEl('h2', { text: 'Jira Dashboard Settings' });

    // Description
    const description = containerEl.createEl('p');
    description.innerHTML = `
      Configure your Jira connection settings. Your credentials will be encrypted and stored securely.<br/>
      <strong>Note:</strong> You'll need a Jira API token - <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank">create one here</a>.
    `;
    description.style.marginBottom = '20px';
    description.style.color = 'var(--text-muted)';

    // Settings container
    this.settingsContainer = containerEl.createEl('div');
    this.renderSettings();
  }

  private renderSettings(): void {
    if (!this.settingsContainer) return;
    
    this.settingsContainer.empty();

    // Server URL Setting
    new Setting(this.settingsContainer)
      .setName('Jira Server URL')
      .setDesc('The base URL of your Jira instance (e.g., https://yourcompany.atlassian.net)')
      .addText(text => text
        .setPlaceholder('https://yourcompany.atlassian.net')
        .setValue(this.currentFormData.serverUrl || this.settings.serverUrl)
        .onChange(async (value) => {
          this.currentFormData.serverUrl = value;
        }));

    // Email Setting
    new Setting(this.settingsContainer)
      .setName('Email Address')
      .setDesc('Your Jira account email address')
      .addText(text => text
        .setPlaceholder('your-email@company.com')
        .setValue(this.currentFormData.email || this.settings.email)
        .onChange(async (value) => {
          this.currentFormData.email = value;
        }));

    // API Token Setting
    new Setting(this.settingsContainer)
      .setName('API Token')
      .setDesc('Your Jira API token (not your password)')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('Your API token')
          .setValue(this.currentFormData.apiToken || this.settings.apiToken)
          .onChange(async (value) => {
            this.currentFormData.apiToken = value;
          });
      });

    // Master Password Setting
    new Setting(this.settingsContainer)
      .setName('Master Password')
      .setDesc('Password to encrypt your credentials (required for security)')
      .addText(text => {
        text.inputEl.type = 'password';
        text.setPlaceholder('Choose a strong password')
          .setValue(this.currentFormData.masterPassword || '')
          .onChange(async (value) => {
            this.currentFormData.masterPassword = value;
          });
      });

    // Action buttons
    const buttonContainer = this.settingsContainer.createEl('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';

    // Test Connection button
    const testButton = buttonContainer.createEl('button', { 
      text: this.isTestingConnection ? 'Testing...' : 'Test Connection',
      cls: 'mod-cta'
    });
    testButton.disabled = this.isTestingConnection;
    testButton.onclick = () => this.testConnection();

    // Save Settings button
    const saveButton = buttonContainer.createEl('button', { 
      text: 'Save Settings',
      cls: 'mod-cta'
    });
    saveButton.onclick = () => this.saveSettings();

    // Clear Credentials button
    const clearButton = buttonContainer.createEl('button', { 
      text: 'Clear Credentials',
      cls: 'mod-warning'
    });
    clearButton.onclick = () => this.clearCredentials();

    // Connection status
    this.renderConnectionStatus();
  }

  private renderConnectionStatus(): void {
    if (!this.settingsContainer) return;

    // Check if we have stored credentials
    this.plugin.authManager.getStoredCredentials().then(storedCreds => {
      if (storedCreds) {
        const statusEl = this.settingsContainer!.createEl('div');
        statusEl.style.marginTop = '15px';
        statusEl.style.padding = '10px';
        statusEl.style.backgroundColor = 'var(--background-modifier-success)';
        statusEl.style.borderRadius = '4px';
        statusEl.innerHTML = `
          <strong>✓ Credentials Stored</strong><br/>
          <span style="color: var(--text-muted); font-size: 0.9em;">
            Your Jira credentials are encrypted and saved. Use "Test Connection" to verify they still work.
          </span>
        `;
      }
    }).catch(() => {
      // No credentials stored, that's fine
    });
  }

  private async testConnection(): Promise<void> {
    if (this.isTestingConnection) return;

    const serverUrl = this.currentFormData.serverUrl?.trim();
    const email = this.currentFormData.email?.trim();
    const apiToken = this.currentFormData.apiToken?.trim();
    const masterPassword = this.currentFormData.masterPassword?.trim();

    // Check if we have current form data or should test stored credentials
    const hasFormData = serverUrl && email && apiToken && masterPassword;
    
    if (!hasFormData) {
      // Try to test with stored credentials
      if (!masterPassword) {
        new Notice('Please enter your master password to test the connection', 5000);
        return;
      }

      this.isTestingConnection = true;
      this.renderSettings(); // Refresh to show "Testing..." state

      try {
        const result = await this.plugin.authManager.testConnection(masterPassword);
        if (result.success) {
          new Notice(`✓ ${result.message}`, 5000);
        } else {
          new Notice(`✗ ${result.message}`, 8000);
        }
      } catch (error) {
        console.error('Connection test failed:', error);
        new Notice(`✗ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
      }

      this.isTestingConnection = false;
      this.renderSettings();
      return;
    }

    // Test with form data
    if (!serverUrl || !email || !apiToken) {
      new Notice('Please fill in all required fields (Server URL, Email, API Token)', 5000);
      return;
    }

    // Validate server URL format
    try {
      const url = new URL(serverUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        new Notice('Server URL must use HTTP or HTTPS protocol', 5000);
        return;
      }
    } catch {
      new Notice('Please enter a valid server URL', 5000);
      return;
    }

    this.isTestingConnection = true;
    this.renderSettings(); // Refresh to show "Testing..." state

    try {
      const credentials: JiraCredentials = {
        serverUrl: serverUrl.replace(/\/$/, ''), // Remove trailing slash
        email,
        apiToken
      };

      const isValid = await this.plugin.authManager.validateCredentials(credentials);
      
      if (isValid) {
        new Notice('✓ Connection successful! Your credentials are valid.', 5000);
      } else {
        new Notice('✗ Connection failed. Please check your credentials and server URL.', 8000);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      new Notice(`✗ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
    }

    this.isTestingConnection = false;
    this.renderSettings();
  }

  private async saveSettings(): Promise<void> {
    const serverUrl = this.currentFormData.serverUrl?.trim();
    const email = this.currentFormData.email?.trim();
    const apiToken = this.currentFormData.apiToken?.trim();
    const masterPassword = this.currentFormData.masterPassword?.trim();

    if (!serverUrl || !email || !apiToken || !masterPassword) {
      new Notice('Please fill in all required fields before saving', 5000);
      return;
    }

    // Validate server URL format
    try {
      const url = new URL(serverUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        new Notice('Server URL must use HTTP or HTTPS protocol', 5000);
        return;
      }
    } catch {
      new Notice('Please enter a valid server URL', 5000);
      return;
    }

    try {
      const credentials: JiraCredentials = {
        serverUrl: serverUrl.replace(/\/$/, ''), // Remove trailing slash
        email,
        apiToken
      };

      // First validate the credentials
      const isValid = await this.plugin.authManager.validateCredentials(credentials);
      if (!isValid) {
        new Notice('✗ Cannot save invalid credentials. Please test the connection first.', 8000);
        return;
      }

      // Encrypt and store credentials
      const encryptedData = await this.plugin.authManager.encryptCredentials(credentials, masterPassword);
      await this.plugin.authManager.storeCredentials(encryptedData);

      // Update HTTP client configuration
      this.plugin.httpClient.updateConfig({
        baseUrl: credentials.serverUrl,
        email: credentials.email,
        apiToken: credentials.apiToken
      });

      // Update local settings
      this.settings = {
        serverUrl: credentials.serverUrl,
        email: credentials.email,
        apiToken: credentials.apiToken,
        masterPassword: '' // Never store master password in memory
      };

      // Clear form data master password for security
      this.currentFormData.masterPassword = '';

      new Notice('✓ Settings saved successfully!', 5000);
      this.renderSettings(); // Refresh to show updated status
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      new Notice(`✗ Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
    }
  }

  private async clearCredentials(): Promise<void> {
    try {
      await this.plugin.authManager.clearCredentials();
      
      // Reset form and settings
      this.currentFormData = {};
      this.settings = DEFAULT_SETTINGS;
      
      new Notice('✓ Credentials cleared successfully', 5000);
      this.renderSettings(); // Refresh UI
      
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      new Notice(`✗ Failed to clear credentials: ${error instanceof Error ? error.message : 'Unknown error'}`, 8000);
    }
  }

  async loadSettings(): Promise<void> {
    // Load any existing unencrypted settings (like form state)
    const data = await this.plugin.loadData();
    if (data?.settings) {
      // Only load non-sensitive data
      this.settings.serverUrl = data.settings.serverUrl || DEFAULT_SETTINGS.serverUrl;
      this.settings.email = data.settings.email || DEFAULT_SETTINGS.email;
      // Never load API token or master password from storage
    }
  }

  async saveSettingsData(): Promise<void> {
    // Save only non-sensitive form state data
    const dataToSave = {
      settings: {
        serverUrl: this.settings.serverUrl,
        email: this.settings.email
        // Never save API token or master password
      }
    };
    
    const existingData = await this.plugin.loadData() || {};
    await this.plugin.saveData({ ...existingData, ...dataToSave });
  }

  hide(): void {
    // Save form state when hiding
    this.saveSettingsData().catch(console.error);
  }
}