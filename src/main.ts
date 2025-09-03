import { Plugin, WorkspaceLeaf } from 'obsidian';
import { JiraView, VIEW_TYPE_JIRA_DASHBOARD } from './views/JiraView';
import { AuthManager } from './services/AuthManager';
import { JiraApiService } from './services/jiraApiService';
import { HttpClient } from './services/httpClient';
import { RateLimiter } from './services/rateLimiter';

export default class JiraDashboardPlugin extends Plugin {
  authManager!: AuthManager;
  jiraService!: JiraApiService;
  httpClient!: HttpClient;
  rateLimiter!: RateLimiter;

  async onload() {
    console.log('Loading Jira Dashboard plugin');

    // Initialize services
    this.authManager = new AuthManager(this);
    
    // Initialize HTTP client and rate limiter
    this.httpClient = new HttpClient({
      baseUrl: '', // Will be set when credentials are configured
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

    // Add command to configure Jira connection
    this.addCommand({
      id: 'configure-jira-connection',
      name: 'Configure Jira Connection',
      callback: () => {
        // This will open settings tab in the future
        console.log('Opening Jira settings...');
      }
    });
  }

  async onunload() {
    console.log('Unloading Jira Dashboard plugin');
    // Clean up any resources
    this.jiraService.destroy();
    await this.authManager.clearCredentials();
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
}