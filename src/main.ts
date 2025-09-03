import { Plugin, WorkspaceLeaf, Notice, Modal, Setting } from 'obsidian';
import { JiraView, VIEW_TYPE_JIRA_DASHBOARD } from './views/JiraView';
import { AuthManager } from './services/AuthManager';
import { JiraApiService } from './services/jiraApiService';
import { ObsidianHttpClient } from './services/ObsidianHttpClient';
import { RateLimiter } from './services/rateLimiter';
import { JiraSettingsTab } from './settings/SettingsTab';
import { NoteSyncService } from './services/NoteSyncService';
import { createIssueKey } from './services/types';

export default class JiraDashboardPlugin extends Plugin {
  authManager!: AuthManager;
  jiraService!: JiraApiService;
  httpClient!: ObsidianHttpClient;
  rateLimiter!: RateLimiter;
  noteSyncService!: NoteSyncService;

  async onload() {
    console.log('Loading Jira Dashboard plugin');

    // Initialize services
    this.authManager = new AuthManager(this);
    
    // Initialize HTTP client with default empty config
    // Will be updated when credentials are loaded or configured
    this.httpClient = new ObsidianHttpClient({
      baseUrl: 'https://richemont.atlassian.net', // Default to common server
      email: '',
      apiToken: ''
    });
    
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 100,
      burstLimit: 100
    });
    
    // Initialize JIRA service
    this.jiraService = new JiraApiService(
      this.authManager,
      this.httpClient,
      this.rateLimiter
    );

    // Initialize NoteSyncService
    this.noteSyncService = new NoteSyncService(
      this.app,
      this.app.vault,
      this.jiraService
    );

    // Register settings tab
    this.addSettingTab(new JiraSettingsTab(this.app, this));

    // Register the view
    this.registerView(
      VIEW_TYPE_JIRA_DASHBOARD,
      (leaf) => new JiraView(leaf, this)
    );

    // Add ribbon icon
    this.addRibbonIcon('layout-dashboard', 'Jira Dashboard', () => {
      this.activateView();
    });

    // Add command to open dashboard
    this.addCommand({
      id: 'open-jira-dashboard',
      name: 'Open Jira Dashboard',
      callback: () => {
        this.activateView();
      }
    });

    // Add command to sync single issue
    this.addCommand({
      id: 'sync-jira-issue',
      name: 'Sync JIRA Issue to Note',
      callback: async () => {
        // Prompt for issue key
        const issueKey = await this.promptForIssueKey();
        if (issueKey) {
          const result = await this.noteSyncService.syncIssueToNote(
            createIssueKey(issueKey),
            { showProgress: true }
          );
          if (result.success) {
            new Notice(`Issue synced to ${result.notePath}`);
          } else {
            new Notice(`Failed to sync: ${result.error}`);
          }
        }
      }
    });

    // Add command to sync from JQL
    this.addCommand({
      id: 'sync-jira-jql',
      name: 'Sync JIRA Issues from JQL Query',
      callback: async () => {
        // Prompt for JQL
        const jql = await this.promptForJQL();
        if (jql) {
          const result = await this.noteSyncService.syncFromJQL(jql, {
            showProgress: true
          });
          new Notice(`Synced ${result.succeeded}/${result.total} issues`);
        }
      }
    });

    // Add command to configure Jira connection
    this.addCommand({
      id: 'configure-jira-connection',
      name: 'Configure Jira Connection',
      callback: () => {
        // Open the settings tab
        // @ts-ignore - Obsidian's internal API
        const setting = (this.app as any).setting;
        if (setting) {
          setting.open();
          setting.openTabById(this.manifest.id);
        }
      }
    });
  }

  async onunload() {
    console.log('Unloading Jira Dashboard plugin');
    // Clean up any resources
    this.jiraService.destroy();
    // Do NOT clear credentials on unload - we want them to persist!
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_JIRA_DASHBOARD);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_JIRA_DASHBOARD, active: true });
      }
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async promptForIssueKey(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText('Sync JIRA Issue');
      
      let inputValue = '';
      
      new Setting(modal.contentEl)
        .setName('Issue Key')
        .setDesc('Enter the JIRA issue key (e.g., PROJ-123)')
        .addText((text: any) => {
          text.setPlaceholder('PROJ-123')
            .setValue(inputValue)
            .onChange((value: string) => {
              inputValue = value;
            });
          text.inputEl.addEventListener('keypress', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              modal.close();
              resolve(inputValue || null);
            }
          });
          // Focus the input field
          setTimeout(() => text.inputEl.focus(), 10);
        });
      
      new Setting(modal.contentEl)
        .addButton((btn: any) => btn
          .setButtonText('Sync')
          .setCta()
          .onClick(() => {
            modal.close();
            resolve(inputValue || null);
          }))
        .addButton((btn: any) => btn
          .setButtonText('Cancel')
          .onClick(() => {
            modal.close();
            resolve(null);
          }));
      
      modal.open();
    });
  }

  async promptForJQL(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText('Sync JIRA Issues from JQL');
      
      let inputValue = 'assignee = currentUser() AND status != Done';
      
      new Setting(modal.contentEl)
        .setName('JQL Query')
        .setDesc('Enter a JQL query to find issues')
        .addTextArea((text: any) => {
          text.setPlaceholder('project = PROJ AND status = "In Progress"')
            .setValue(inputValue)
            .onChange((value: string) => {
              inputValue = value;
            });
          text.inputEl.rows = 3;
          text.inputEl.cols = 50;
          // Focus the input field
          setTimeout(() => text.inputEl.focus(), 10);
        });
      
      new Setting(modal.contentEl)
        .addButton((btn: any) => btn
          .setButtonText('Sync')
          .setCta()
          .onClick(() => {
            modal.close();
            resolve(inputValue || null);
          }))
        .addButton((btn: any) => btn
          .setButtonText('Cancel')
          .onClick(() => {
            modal.close();
            resolve(null);
          }));
      
      modal.open();
    });
  }
}