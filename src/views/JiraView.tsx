import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import JiraDashboardPlugin from '../main';
import { JiraDashboard } from '../components/JiraDashboard';
import { ObsidianThemeProvider } from '../components/ObsidianThemeProvider';
import { JiraServiceProvider } from '../contexts/JiraServiceContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const VIEW_TYPE_JIRA_DASHBOARD = 'jira-dashboard-view';

export class JiraView extends ItemView {
  private root: Root | null = null;
  private plugin: JiraDashboardPlugin;
  private queryClient: QueryClient;

  constructor(leaf: WorkspaceLeaf, plugin: JiraDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          gcTime: 10 * 60 * 1000, // 10 minutes
          retry: 3,
          retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
      },
    });
  }

  getViewType() {
    return VIEW_TYPE_JIRA_DASHBOARD;
  }

  getDisplayText() {
    return 'Jira Dashboard';
  }

  getIcon() {
    return 'layout-dashboard';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('jira-dashboard-container');
    
    // Create React root and render dashboard
    this.root = createRoot(container);
    this.root.render(
      <React.StrictMode>
        <QueryClientProvider client={this.queryClient}>
          <ObsidianThemeProvider>
            <JiraServiceProvider plugin={this.plugin}>
              <JiraDashboard plugin={this.plugin} />
            </JiraServiceProvider>
          </ObsidianThemeProvider>
        </QueryClientProvider>
      </React.StrictMode>
    );
  }

  async onClose() {
    // Clean up React root
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    
    // Clean up query client
    this.queryClient.clear();
  }

  onResize() {
    // Handle view resize if needed
    // Trigger resize event for any components that need it
  }
}