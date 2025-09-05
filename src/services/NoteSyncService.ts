/**
 * NoteSyncService - One-way synchronization from JIRA to Obsidian
 * 
 * Handles creating and updating Obsidian notes from JIRA issues,
 * organizing them into folders, and preserving formatting.
 */

import { App, Notice, TFile, TFolder, Vault, normalizePath } from 'obsidian';
import { JiraApiService } from './jiraApiService';
import { JiraIssue, IssueKey } from './types';
import { TemplateManager } from '../templates/TemplateManager';

export interface SyncOptions {
  folder?: string;
  overwrite?: boolean;
  showProgress?: boolean;
}

export interface SyncResult {
  success: boolean;
  notePath?: string;
  error?: string;
}

export interface BulkSyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Map<string, SyncResult>;
}

export class NoteSyncService {
  private templateManager: TemplateManager;

  constructor(
    private app: App,
    private vault: Vault,
    private jiraService: JiraApiService
  ) {
    this.templateManager = new TemplateManager(app);
  }

  /**
   * Sync a single JIRA issue to an Obsidian note
   */
  async syncIssueToNote(issueKey: IssueKey, options: SyncOptions = {}): Promise<SyncResult> {
    try {
      // Fetch the issue from JIRA
      const issue = await this.jiraService.getIssue(issueKey);
      if (!issue) {
        return {
          success: false,
          error: `Issue ${issueKey} not found`
        };
      }

      // Fetch comments for the issue
      try {
        const commentsResult = await this.jiraService.getComments(issueKey);
        if (commentsResult && commentsResult.comments) {
          // Convert comment bodies to Obsidian markdown
          const processedComments = commentsResult.comments.map(comment => ({
            ...comment,
            body: this.convertMarkdown(comment.body),
            created_formatted: new Date(comment.created).toLocaleString(),
            updated_formatted: new Date(comment.updated).toLocaleString()
          }));
          // Add comments to the issue fields for template processing
          (issue.fields as any).comments = processedComments;
        }
      } catch (error) {
        console.warn(`Failed to fetch comments for ${issueKey}:`, error);
        // Continue without comments if fetching fails
        (issue.fields as any).comments = [];
      }

      // Convert JIRA description to Obsidian markdown
      if (issue.fields.description) {
        issue.fields.description = this.convertMarkdown(issue.fields.description);
      }

      // Determine the folder structure
      const folderPath = this.getFolderPath(issue, options.folder);

      // Create the note using TemplateManager
      const createdNote = await this.templateManager.createNoteForIssue(issue, {
        outputPath: folderPath,
        replaceExisting: options.overwrite || false,
        openAfterCreation: false
      });

      return {
        success: true,
        notePath: createdNote.path
      };
    } catch (error) {
      console.error(`Failed to sync issue ${issueKey}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync multiple JIRA issues to Obsidian notes
   */
  async bulkSyncIssues(
    issueKeys: IssueKey[],
    options: SyncOptions = {}
  ): Promise<BulkSyncResult> {
    const results = new Map<string, SyncResult>();
    let succeeded = 0;
    let failed = 0;

    // Show progress if requested
    if (options.showProgress) {
      new Notice(`Starting sync of ${issueKeys.length} issues...`);
    }

    // Process issues in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < issueKeys.length; i += batchSize) {
      const batch = issueKeys.slice(i, Math.min(i + batchSize, issueKeys.length));
      
      // Process batch in parallel
      const batchPromises = batch.map(async (key) => {
        const result = await this.syncIssueToNote(key, options);
        results.set(key, result);
        
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }

        // Update progress
        if (options.showProgress && (succeeded + failed) % 10 === 0) {
          new Notice(`Synced ${succeeded + failed}/${issueKeys.length} issues...`);
        }
        
        return result;
      });

      await Promise.all(batchPromises);
    }

    // Show completion notice
    if (options.showProgress) {
      new Notice(
        `Sync complete! ✓ ${succeeded} succeeded, ✗ ${failed} failed`,
        5000
      );
    }

    return {
      total: issueKeys.length,
      succeeded,
      failed,
      results
    };
  }

  /**
   * Sync issues from a JQL query
   */
  async syncFromJQL(jql: string, options: SyncOptions = {}): Promise<BulkSyncResult> {
    try {
      // Search for issues using JQL
      const searchResult = await this.jiraService.searchIssues({ jql });
      
      if (!searchResult || searchResult.issues.length === 0) {
        new Notice('No issues found matching the query');
        return {
          total: 0,
          succeeded: 0,
          failed: 0,
          results: new Map()
        };
      }

      // Extract issue keys
      const issueKeys = searchResult.issues.map(issue => issue.key);
      
      // Perform bulk sync
      return await this.bulkSyncIssues(issueKeys, {
        ...options,
        showProgress: true
      });
    } catch (error) {
      console.error('Failed to sync from JQL:', error);
      new Notice(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: new Map()
      };
    }
  }

  /**
   * Determine the folder path for an issue
   */
  private getFolderPath(issue: JiraIssue, baseFolder?: string): string {
    const base = baseFolder || 'JIRA Issues';
    const projectFolder = issue.fields.project.name;
    
    // Organize by project and optionally by issue type
    const issuetypeFolder = issue.fields.issuetype.name;
    
    // Create a hierarchical structure
    return normalizePath(`${base}/${projectFolder}/${issuetypeFolder}`);
  }

  /**
   * Ensure a folder exists, creating it if necessary
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    const folder = this.vault.getAbstractFileByPath(folderPath);
    
    if (!folder) {
      // Create the folder hierarchy
      const parts = folderPath.split('/');
      let currentPath = '';
      
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const normalizedPath = normalizePath(currentPath);
        
        const existing = this.vault.getAbstractFileByPath(normalizedPath);
        if (!existing) {
          try {
            await this.vault.createFolder(normalizedPath);
          } catch (error) {
            // Folder might have been created by another operation
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('already exists')) {
              throw error;
            }
          }
        }
      }
    } else if (!(folder instanceof TFolder)) {
      throw new Error(`Path ${folderPath} exists but is not a folder`);
    }
  }

  /**
   * Convert JIRA markdown to Obsidian markdown
   */
  private convertMarkdown(jiraText: string): string {
    if (!jiraText) return '';

    let converted = jiraText;

    // Convert JIRA headers to markdown headers
    converted = converted.replace(/^h1\.\s+(.+)$/gm, '# $1');
    converted = converted.replace(/^h2\.\s+(.+)$/gm, '## $1');
    converted = converted.replace(/^h3\.\s+(.+)$/gm, '### $1');
    converted = converted.replace(/^h4\.\s+(.+)$/gm, '#### $1');
    converted = converted.replace(/^h5\.\s+(.+)$/gm, '##### $1');
    converted = converted.replace(/^h6\.\s+(.+)$/gm, '###### $1');

    // Convert JIRA bold to markdown bold
    converted = converted.replace(/\*([^*]+)\*/g, '**$1**');

    // Convert JIRA italic to markdown italic
    converted = converted.replace(/_([^_]+)_/g, '*$1*');

    // Convert JIRA strikethrough to markdown strikethrough
    converted = converted.replace(/-([^-]+)-/g, '~~$1~~');

    // Convert JIRA code blocks
    converted = converted.replace(/\{code:([^}]*)\}([\s\S]*?)\{code\}/g, '```$1\n$2\n```');
    converted = converted.replace(/\{code\}([\s\S]*?)\{code\}/g, '```\n$1\n```');

    // Convert JIRA inline code
    converted = converted.replace(/\{\{([^}]+)\}\}/g, '`$1`');

    // Convert JIRA links
    converted = converted.replace(/\[([^\]]+)\|([^\]]+)\]/g, '[$1]($2)');

    // Convert JIRA bullet lists
    converted = converted.replace(/^\*\s+(.+)$/gm, '- $1');
    converted = converted.replace(/^\*\*\s+(.+)$/gm, '  - $1');
    converted = converted.replace(/^\*\*\*\s+(.+)$/gm, '    - $1');

    // Convert JIRA numbered lists
    converted = converted.replace(/^#\s+(.+)$/gm, '1. $1');
    converted = converted.replace(/^##\s+(.+)$/gm, '   1. $1');
    converted = converted.replace(/^###\s+(.+)$/gm, '      1. $1');

    // Convert JIRA quotes
    converted = converted.replace(/^bq\.\s+(.+)$/gm, '> $1');

    // Convert JIRA tables (basic support)
    converted = converted.replace(/\|\|([^|]+)\|\|/g, '| **$1** |');

    return converted;
  }
}