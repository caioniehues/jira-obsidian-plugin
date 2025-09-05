/**
 * BidirectionalSyncService - Two-way synchronization between JIRA and Obsidian
 * 
 * Handles syncing changes from Obsidian back to JIRA with conflict detection
 * and resolution capabilities.
 */

import { 
  App, 
  Notice, 
  TFile, 
  Modal, 
  Setting,
  MarkdownView,
  parseYaml,
  stringifyYaml,
  MetadataCache,
  FrontMatterCache,
  normalizePath
} from 'obsidian';
import { JiraApiService } from './jiraApiService';
import { JiraIssue, IssueKey, createIssueKey } from './types';
import { NoteSyncService } from './NoteSyncService';
import moment from 'moment';

export interface SyncStatus {
  lastSyncTime?: number;
  lastJiraUpdate?: string;
  lastLocalUpdate?: number;
  syncState: 'synced' | 'modified' | 'conflict' | 'error';
  conflictDetails?: ConflictInfo;
}

export interface ConflictInfo {
  localChanges: FieldChange[];
  remoteChanges: FieldChange[];
  conflictedFields: string[];
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface SyncMetadata {
  [issueKey: string]: SyncStatus;
}

export class BidirectionalSyncService {
  private syncMetadata: SyncMetadata = {};
  private watchedFiles: Map<string, TFile> = new Map();
  private fileChangeHandler: ((file: any) => void) | null = null;

  constructor(
    private app: App,
    private jiraService: JiraApiService,
    private noteSyncService: NoteSyncService
  ) {
    this.loadSyncMetadata();
    this.setupFileWatcher();
  }

  /**
   * Setup file watcher for detecting changes in synced notes
   */
  private setupFileWatcher(): void {
    // Register event handler for file modifications
    this.fileChangeHandler = this.handleFileChange.bind(this);
    this.app.vault.on('modify', this.fileChangeHandler);
  }

  /**
   * Handle file change events
   */
  private async handleFileChange(file: any): Promise<void> {
    // Ensure file is a TFile
    if (!(file instanceof TFile)) {
      return;
    }
    // Check if this is a watched JIRA note
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter?.['jira-key']) {
      return;
    }

    const issueKey = frontmatter['jira-key'];
    const syncStatus = this.syncMetadata[issueKey] || {
      syncState: 'modified',
      lastLocalUpdate: Date.now()
    };

    // Mark as modified
    syncStatus.syncState = 'modified';
    syncStatus.lastLocalUpdate = Date.now();
    this.syncMetadata[issueKey] = syncStatus;
    
    // Save metadata
    await this.saveSyncMetadata();

    // Add status indicator to the note
    await this.updateSyncStatusIndicator(file, 'modified');
  }

  /**
   * Sync changes from an Obsidian note back to JIRA
   */
  async syncNoteToJira(file: TFile): Promise<void> {
    try {
      // Parse frontmatter
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      
      if (!frontmatter?.['jira-key']) {
        new Notice('No JIRA issue key found in note frontmatter');
        return;
      }

      const issueKey = createIssueKey(frontmatter['jira-key']);
      
      // Get current JIRA state
      const jiraIssue = await this.jiraService.getIssue(issueKey);
      if (!jiraIssue) {
        new Notice(`Could not fetch JIRA issue ${issueKey}`);
        return;
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(file, jiraIssue);
      if (conflicts.length > 0) {
        // Show conflict resolution UI
        const resolution = await this.showConflictResolution(file, jiraIssue, conflicts);
        if (!resolution) {
          return; // User cancelled
        }
        // Apply resolution
        await this.applyConflictResolution(file, jiraIssue, resolution);
      } else {
        // No conflicts, proceed with sync
        await this.pushChangesToJira(file, jiraIssue);
      }

      // Update sync status
      this.syncMetadata[issueKey] = {
        lastSyncTime: Date.now(),
        lastJiraUpdate: jiraIssue.fields.updated,
        lastLocalUpdate: file.stat.mtime,
        syncState: 'synced'
      };
      
      await this.saveSyncMetadata();
      await this.updateSyncStatusIndicator(file, 'synced');
      
      new Notice(`✓ Synced ${issueKey} to JIRA`);
    } catch (error) {
      console.error('Failed to sync note to JIRA:', error);
      new Notice(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect conflicts between local and remote changes
   */
  private async detectConflicts(file: TFile, jiraIssue: JiraIssue): Promise<FieldChange[]> {
    const conflicts: FieldChange[] = [];
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    
    if (!frontmatter) return conflicts;

    const issueKey = frontmatter['jira-key'];
    const syncStatus = this.syncMetadata[issueKey];
    
    // If we have sync metadata, check if JIRA was updated since last sync
    if (syncStatus?.lastJiraUpdate) {
      const lastJiraUpdate = moment(jiraIssue.fields.updated);
      const lastSyncTime = moment(syncStatus.lastSyncTime || 0);
      
      if (lastJiraUpdate.isAfter(lastSyncTime)) {
        // JIRA has been updated since our last sync
        // Compare fields to find conflicts
        
        // Check status
        if (frontmatter['status'] !== jiraIssue.fields.status.name) {
          conflicts.push({
            field: 'status',
            oldValue: jiraIssue.fields.status.name,
            newValue: frontmatter['status']
          });
        }
        
        // Check priority
        if (frontmatter['priority'] !== jiraIssue.fields.priority?.name) {
          conflicts.push({
            field: 'priority',
            oldValue: jiraIssue.fields.priority?.name,
            newValue: frontmatter['priority']
          });
        }
        
        // Check assignee
        const localAssignee = frontmatter['assignee'];
        const remoteAssignee = jiraIssue.fields.assignee?.displayName;
        if (localAssignee !== remoteAssignee) {
          conflicts.push({
            field: 'assignee',
            oldValue: remoteAssignee,
            newValue: localAssignee
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Show conflict resolution UI
   */
  private async showConflictResolution(
    file: TFile,
    jiraIssue: JiraIssue,
    conflicts: FieldChange[]
  ): Promise<Map<string, any> | null> {
    return new Promise((resolve) => {
      const modal = new ConflictResolutionModal(
        this.app,
        file,
        jiraIssue,
        conflicts,
        (resolution) => resolve(resolution)
      );
      modal.open();
    });
  }

  /**
   * Apply conflict resolution
   */
  private async applyConflictResolution(
    file: TFile,
    jiraIssue: JiraIssue,
    resolution: Map<string, any>
  ): Promise<void> {
    // Update local file with resolved values
    const content = await this.app.vault.read(file);
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatter = parseYaml(match[1]) || {};
      
      // Apply resolutions
      for (const [field, value] of resolution) {
        frontmatter[field] = value;
      }
      
      // Update the file
      const newFrontmatter = stringifyYaml(frontmatter);
      const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}---`);
      await this.app.vault.modify(file, newContent);
    }
    
    // Then sync to JIRA
    await this.pushChangesToJira(file, jiraIssue);
  }

  /**
   * Push changes from note to JIRA
   */
  private async pushChangesToJira(file: TFile, jiraIssue: JiraIssue): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return;

    // Build update payload
    const updateData: any = {
      fields: {}
    };

    // Map frontmatter fields to JIRA fields
    // Summary
    if (frontmatter['title']) {
      const titleMatch = frontmatter['title'].match(/^[A-Z]+-\d+:\s*(.+)$/);
      if (titleMatch) {
        updateData.fields.summary = titleMatch[1];
      }
    }

    // Description - parse from note content
    const content = await this.app.vault.read(file);
    const descriptionMatch = content.match(/## Description\n([\s\S]*?)(?=\n##|$)/);
    if (descriptionMatch) {
      updateData.fields.description = this.convertMarkdownToJira(descriptionMatch[1].trim());
    }

    // Priority
    if (frontmatter['priority'] && frontmatter['priority'] !== jiraIssue.fields.priority?.name) {
      // Need to get priority ID from name
      updateData.fields.priority = { name: frontmatter['priority'] };
    }

    // Labels
    if (frontmatter['labels']) {
      updateData.fields.labels = frontmatter['labels'];
    }

    // Only update if we have changes
    if (Object.keys(updateData.fields).length > 0) {
      await this.jiraService.updateIssue(jiraIssue.key, updateData);
    }

    // Handle status transitions separately
    if (frontmatter['status'] && frontmatter['status'] !== jiraIssue.fields.status.name) {
      await this.transitionIssueStatus(jiraIssue.key, frontmatter['status']);
    }
  }

  /**
   * Transition issue status
   */
  private async transitionIssueStatus(issueKey: IssueKey, targetStatus: string): Promise<void> {
    try {
      // Get available transitions
      const transitions = await this.jiraService.getTransitions(issueKey);
      
      // Find transition to target status
      const transition = transitions.find(t => 
        t.to.name.toLowerCase() === targetStatus.toLowerCase()
      );
      
      if (transition) {
        await this.jiraService.transitionIssue(issueKey, {
          transition: { id: transition.id }
        });
      } else {
        new Notice(`Cannot transition to status: ${targetStatus}`);
      }
    } catch (error) {
      console.error('Failed to transition issue status:', error);
      new Notice(`Failed to change status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Obsidian markdown back to JIRA syntax
   */
  private convertMarkdownToJira(markdown: string): string {
    if (!markdown) return '';

    let converted = markdown;

    // Convert markdown headers to JIRA headers
    converted = converted.replace(/^# (.+)$/gm, 'h1. $1');
    converted = converted.replace(/^## (.+)$/gm, 'h2. $1');
    converted = converted.replace(/^### (.+)$/gm, 'h3. $1');
    converted = converted.replace(/^#### (.+)$/gm, 'h4. $1');
    converted = converted.replace(/^##### (.+)$/gm, 'h5. $1');
    converted = converted.replace(/^###### (.+)$/gm, 'h6. $1');

    // Convert markdown bold to JIRA bold
    converted = converted.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    // Convert markdown italic to JIRA italic
    converted = converted.replace(/\*([^*]+)\*/g, '_$1_');

    // Convert markdown strikethrough to JIRA strikethrough
    converted = converted.replace(/~~([^~]+)~~/g, '-$1-');

    // Convert markdown code blocks
    converted = converted.replace(/```(\w+)?\n([\s\S]*?)```/g, '{code:$1}$2{code}');
    converted = converted.replace(/```\n([\s\S]*?)```/g, '{code}$1{code}');

    // Convert markdown inline code
    converted = converted.replace(/`([^`]+)`/g, '{{$1}}');

    // Convert markdown links
    converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1|$2]');

    // Convert markdown bullet lists
    converted = converted.replace(/^- (.+)$/gm, '* $1');
    converted = converted.replace(/^  - (.+)$/gm, '** $1');
    converted = converted.replace(/^    - (.+)$/gm, '*** $1');

    // Convert markdown numbered lists
    converted = converted.replace(/^\d+\. (.+)$/gm, '# $1');
    converted = converted.replace(/^   \d+\. (.+)$/gm, '## $1');
    converted = converted.replace(/^      \d+\. (.+)$/gm, '### $1');

    // Convert markdown quotes
    converted = converted.replace(/^> (.+)$/gm, 'bq. $1');

    // Convert markdown tables (basic support)
    converted = converted.replace(/^\| \*\*([^|]+)\*\* \|/gm, '||$1||');

    return converted;
  }

  /**
   * Update sync status indicator in note
   */
  private async updateSyncStatusIndicator(file: TFile, status: 'synced' | 'modified' | 'conflict' | 'error'): Promise<void> {
    const content = await this.app.vault.read(file);
    const statusEmoji = {
      'synced': '✅',
      'modified': '📝',
      'conflict': '⚠️',
      'error': '❌'
    };

    // Add or update status in frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatter = parseYaml(match[1]) || {};
      frontmatter['sync-status'] = `${statusEmoji[status]} ${status}`;
      frontmatter['last-sync'] = moment().format('YYYY-MM-DD HH:mm:ss');
      
      const newFrontmatter = stringifyYaml(frontmatter);
      const newContent = content.replace(frontmatterRegex, `---\n${newFrontmatter}---`);
      
      // Temporarily disable file watcher to avoid triggering on our own update
      this.app.vault.off('modify', this.fileChangeHandler!);
      await this.app.vault.modify(file as TFile, newContent);
      setTimeout(() => {
        if (this.fileChangeHandler) {
          this.app.vault.on('modify', this.fileChangeHandler);
        }
      }, 100);
    }
  }

  /**
   * Load sync metadata from plugin data
   */
  private async loadSyncMetadata(): Promise<void> {
    const data = await this.app.vault.adapter.read(
      normalizePath(this.app.vault.configDir + '/plugins/jira-dashboard/sync-metadata.json')
    ).catch(() => '{}');
    
    this.syncMetadata = JSON.parse(data);
  }

  /**
   * Save sync metadata to plugin data
   */
  private async saveSyncMetadata(): Promise<void> {
    const pluginDir = normalizePath(this.app.vault.configDir + '/plugins/jira-dashboard');
    
    // Ensure plugin directory exists
    if (!await this.app.vault.adapter.exists(pluginDir)) {
      await this.app.vault.adapter.mkdir(pluginDir);
    }
    
    await this.app.vault.adapter.write(
      normalizePath(pluginDir + '/sync-metadata.json'),
      JSON.stringify(this.syncMetadata, null, 2)
    );
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    if (this.fileChangeHandler) {
      this.app.vault.off('modify', this.fileChangeHandler);
    }
  }
}

/**
 * Modal for conflict resolution
 */
class ConflictResolutionModal extends Modal {
  private resolution: Map<string, any> = new Map();

  constructor(
    app: App,
    private file: TFile,
    private jiraIssue: JiraIssue,
    private conflicts: FieldChange[],
    private onResolve: (resolution: Map<string, any> | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Resolve Sync Conflicts' });
    
    const desc = contentEl.createEl('p');
    desc.innerHTML = `
      Both JIRA and your note have been modified since the last sync.<br/>
      Choose which version to keep for each conflicted field:
    `;

    // Show each conflict
    this.conflicts.forEach(conflict => {
      new Setting(contentEl)
        .setName(conflict.field.charAt(0).toUpperCase() + conflict.field.slice(1))
        .setDesc(`JIRA: "${conflict.oldValue}" | Note: "${conflict.newValue}"`)
        .addDropdown(dropdown => {
          dropdown
            .addOption('jira', `Keep JIRA value: ${conflict.oldValue}`)
            .addOption('local', `Keep local value: ${conflict.newValue}`)
            .setValue('local')
            .onChange(value => {
              if (value === 'jira') {
                this.resolution.set(conflict.field, conflict.oldValue);
              } else {
                this.resolution.set(conflict.field, conflict.newValue);
              }
            });
          
          // Default to local value
          this.resolution.set(conflict.field, conflict.newValue);
        });
    });

    // Action buttons
    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Apply Resolution')
        .setCta()
        .onClick(() => {
          this.close();
          this.onResolve(this.resolution);
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => {
          this.close();
          this.onResolve(null);
        }));
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}