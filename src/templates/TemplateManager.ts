/**
 * Template Manager
 * 
 * Manages template storage, retrieval, and integration with Obsidian vault.
 * Handles note creation and template customization.
 */

import { App, TFile, TFolder, Vault, normalizePath } from 'obsidian';
import { TemplateEngine } from './TemplateEngine';
import { TemplateSettings, NoteCreationOptions, CreatedNote } from './types';
import { JiraIssue } from '../services/types';

export class TemplateManager {
  private templateEngine: TemplateEngine;
  private settings: TemplateSettings;

  constructor(
    private app: App,
    initialSettings?: Partial<TemplateSettings>
  ) {
    this.settings = this.getDefaultSettings();
    if (initialSettings) {
      this.updateSettings(initialSettings);
    }
    
    this.templateEngine = new TemplateEngine({
      templatePath: this.settings.templateLocation,
      customFields: this.settings.customFieldMappings,
      includeComments: this.settings.includeComments,
      includeWorklog: this.settings.includeWorklog,
      dateFormat: this.settings.dateFormat,
    });
  }

  /**
   * Get default template settings
   */
  private getDefaultSettings(): TemplateSettings {
    return {
      defaultTemplate: this.templateEngine.getDefaultTemplate(),
      customTemplates: {},
      templateLocation: 'Templates/JIRA',
      dateFormat: 'YYYY-MM-DD',
      includeComments: false,
      includeWorklog: false,
      customFieldMappings: {
        'story-points': 'customfield_10016',
      },
    };
  }

  /**
   * Update template settings
   */
  updateSettings(newSettings: Partial<TemplateSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update template engine configuration
    this.templateEngine.updateConfig({
      templatePath: this.settings.templateLocation,
      customFields: this.settings.customFieldMappings,
      includeComments: this.settings.includeComments,
      includeWorklog: this.settings.includeWorklog,
      dateFormat: this.settings.dateFormat,
    });
  }

  /**
   * Get current settings
   */
  getSettings(): TemplateSettings {
    return { ...this.settings };
  }

  /**
   * Create a note for a JIRA issue
   */
  async createNoteForIssue(
    issue: JiraIssue,
    options: NoteCreationOptions = {}
  ): Promise<CreatedNote> {
    const template = await this.getTemplate(options.templateName);
    const processedTemplate = await this.templateEngine.processIssue(issue, template);
    
    // Determine output path
    const outputPath = this.getOutputPath(processedTemplate.filename, options.outputPath);
    
    // Check if file exists and handle replacement
    const existingFile = this.app.vault.getAbstractFileByPath(outputPath);
    if (existingFile instanceof TFile && !options.replaceExisting) {
      throw new Error(`File already exists: ${outputPath}. Use replaceExisting: true to overwrite.`);
    }

    // Create directory if it doesn't exist
    await this.ensureDirectoryExists(outputPath);

    // Create the note content with frontmatter
    const noteContent = this.formatNoteWithFrontmatter(
      processedTemplate.content,
      processedTemplate.frontmatter
    );

    // Create or update the file
    let file: TFile;
    if (existingFile instanceof TFile) {
      await this.app.vault.modify(existingFile, noteContent);
      file = existingFile;
    } else {
      file = await this.app.vault.create(outputPath, noteContent);
    }

    // Open the note if requested
    if (options.openAfterCreation) {
      const leaf = this.app.workspace.getUnpinnedLeaf();
      if (leaf) {
        await leaf.openFile(file);
      }
    }

    return {
      path: file.path,
      filename: file.name,
      content: noteContent,
      frontmatter: processedTemplate.frontmatter,
      issue: {
        key: issue.key,
        summary: issue.fields.summary,
      },
    };
  }

  /**
   * Get a template by name or return default
   */
  private async getTemplate(templateName?: string): Promise<string> {
    if (!templateName) {
      return this.settings.defaultTemplate;
    }

    // Check if it's a custom template
    if (this.settings.customTemplates[templateName]) {
      return this.settings.customTemplates[templateName];
    }

    // Try to load from template file
    try {
      const templatePath = normalizePath(`${this.settings.templateLocation}/${templateName}.md`);
      const file = this.app.vault.getAbstractFileByPath(templatePath);
      
      if (file instanceof TFile) {
        return await this.app.vault.read(file);
      }
    } catch (error) {
      console.warn(`Could not load template ${templateName}:`, error);
    }

    // Fallback to default
    return this.settings.defaultTemplate;
  }

  /**
   * Save a custom template
   */
  async saveCustomTemplate(name: string, content: string, saveToVault = true): Promise<void> {
    // Validate template first
    const validation = this.templateEngine.validateTemplate(content);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Store in settings
    this.settings.customTemplates[name] = content;

    // Optionally save to vault
    if (saveToVault) {
      try {
        await this.ensureDirectoryExists(`${this.settings.templateLocation}/${name}.md`);
        const templatePath = normalizePath(`${this.settings.templateLocation}/${name}.md`);
        
        const existingFile = this.app.vault.getAbstractFileByPath(templatePath);
        if (existingFile instanceof TFile) {
          await this.app.vault.modify(existingFile, content);
        } else {
          await this.app.vault.create(templatePath, content);
        }
      } catch (error) {
        console.error(`Failed to save template to vault:`, error);
        throw error;
      }
    }
  }

  /**
   * List available templates
   */
  async getAvailableTemplates(): Promise<string[]> {
    const templates = new Set<string>();
    
    // Add default template
    templates.add('Default');
    
    // Add custom templates from settings
    Object.keys(this.settings.customTemplates).forEach(name => {
      templates.add(name);
    });

    // Add templates from vault
    try {
      const templateFolder = this.app.vault.getAbstractFileByPath(
        normalizePath(this.settings.templateLocation)
      );
      
      if (templateFolder instanceof TFolder) {
        for (const child of templateFolder.children) {
          if (child instanceof TFile && child.extension === 'md') {
            const name = child.basename;
            templates.add(name);
          }
        }
      }
    } catch (error) {
      console.warn('Could not scan template folder:', error);
    }

    return Array.from(templates).sort();
  }

  /**
   * Delete a custom template
   */
  async deleteTemplate(name: string): Promise<void> {
    if (name === 'Default') {
      throw new Error('Cannot delete the default template');
    }

    // Remove from settings
    delete this.settings.customTemplates[name];

    // Remove from vault if exists
    try {
      const templatePath = normalizePath(`${this.settings.templateLocation}/${name}.md`);
      const file = this.app.vault.getAbstractFileByPath(templatePath);
      
      if (file instanceof TFile) {
        await this.app.vault.delete(file);
      }
    } catch (error) {
      console.warn(`Could not delete template file ${name}:`, error);
    }
  }

  /**
   * Preview a template with sample data
   */
  async previewTemplate(templateContent: string): Promise<string> {
    // Create sample JIRA issue for preview
    const sampleIssue: JiraIssue = {
      id: '10001',
      key: 'SAMPLE-123' as any,
      self: 'https://company.atlassian.net/rest/api/2/issue/10001',
      fields: {
        summary: 'Sample Issue for Template Preview',
        description: 'This is a sample issue description to demonstrate template rendering.',
        status: {
          id: '1',
          name: 'In Progress',
          description: 'This issue is being actively worked on.',
          iconUrl: 'https://company.atlassian.net/images/icons/statuses/inprogress.png',
          self: 'https://company.atlassian.net/rest/api/2/status/1',
          statusCategory: {
            id: 4,
            key: 'indeterminate',
            colorName: 'yellow',
            name: 'In Progress'
          }
        },
        priority: {
          id: '3',
          name: 'Medium',
          iconUrl: 'https://company.atlassian.net/images/icons/priorities/medium.svg',
          self: 'https://company.atlassian.net/rest/api/2/priority/3'
        },
        assignee: {
          accountId: 'user123' as any,
          accountType: 'atlassian',
          active: true,
          displayName: 'John Doe',
          emailAddress: 'john.doe@company.com',
          self: 'https://company.atlassian.net/rest/api/2/user?accountId=user123',
          timeZone: 'America/New_York',
          avatarUrls: {
            '16x16': 'https://avatar.example.com/16',
            '24x24': 'https://avatar.example.com/24',
            '32x32': 'https://avatar.example.com/32',
            '48x48': 'https://avatar.example.com/48'
          }
        },
        reporter: {
          accountId: 'user456' as any,
          accountType: 'atlassian',
          active: true,
          displayName: 'Jane Smith',
          emailAddress: 'jane.smith@company.com',
          self: 'https://company.atlassian.net/rest/api/2/user?accountId=user456',
          timeZone: 'America/New_York',
          avatarUrls: {
            '16x16': 'https://avatar.example.com/16',
            '24x24': 'https://avatar.example.com/24',
            '32x32': 'https://avatar.example.com/32',
            '48x48': 'https://avatar.example.com/48'
          }
        },
        created: '2024-01-15T10:30:00.000+0000',
        updated: '2024-01-16T14:20:00.000+0000',
        project: {
          id: 'proj1',
          key: 'SAMPLE' as any,
          name: 'Sample Project',
          projectTypeKey: 'software',
          self: 'https://company.atlassian.net/rest/api/2/project/proj1',
          description: 'A sample project for demonstration',
          lead: {
            accountId: 'user789' as any,
            accountType: 'atlassian',
            active: true,
            displayName: 'Project Lead',
            self: 'https://company.atlassian.net/rest/api/2/user?accountId=user789',
            avatarUrls: {
              '16x16': 'https://avatar.example.com/16',
              '24x24': 'https://avatar.example.com/24',
              '32x32': 'https://avatar.example.com/32',
              '48x48': 'https://avatar.example.com/48'
            }
          },
          assigneeType: 'PROJECT_LEAD',
          versions: [],
          components: [],
          issueTypes: [],
          roles: {}
        },
        issuetype: {
          id: '1',
          name: 'Task',
          description: 'A task that needs to be done',
          iconUrl: 'https://company.atlassian.net/secure/viewavatar?size=xsmall&avatarId=10318',
          self: 'https://company.atlassian.net/rest/api/2/issuetype/1',
          subtask: false,
          avatarId: 10318
        },
        labels: ['backend', 'api', 'improvement'],
        components: [
          {
            id: '1',
            name: 'API',
            description: 'REST API components',
            self: 'https://company.atlassian.net/rest/api/2/component/1',
            assigneeType: 'PROJECT_DEFAULT',
            realAssigneeType: 'PROJECT_DEFAULT',
            isAssigneeTypeValid: true,
            project: 'SAMPLE',
            projectId: 10001
          }
        ],
        fixVersions: [
          {
            id: '1',
            name: 'v1.2.0',
            description: 'Next minor release',
            archived: false,
            released: false,
            releaseDate: '2024-02-15',
            self: 'https://company.atlassian.net/rest/api/2/version/1',
            projectId: 10001,
            startDate: '2024-01-01',
            userStartDate: '01/Jan/24',
            userReleaseDate: '15/Feb/24'
          }
        ],
        customfield_10016: 8 // Story points
      }
    };

    const processed = await this.templateEngine.processIssue(sampleIssue, templateContent);
    return this.formatNoteWithFrontmatter(processed.content, processed.frontmatter);
  }

  /**
   * Get available template variables
   */
  getAvailableVariables() {
    return this.templateEngine.getAvailableVariables();
  }

  /**
   * Validate a template
   */
  validateTemplate(template: string) {
    return this.templateEngine.validateTemplate(template);
  }

  /**
   * Format note content with frontmatter
   */
  private formatNoteWithFrontmatter(content: string, frontmatter: Record<string, any>): string {
    // Check if content already has frontmatter
    if (content.startsWith('---\n')) {
      return content;
    }

    // Build frontmatter
    const frontmatterLines = ['---'];
    Object.entries(frontmatter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        frontmatterLines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
      } else if (typeof value === 'string') {
        frontmatterLines.push(`${key}: "${value}"`);
      } else {
        frontmatterLines.push(`${key}: ${value}`);
      }
    });
    frontmatterLines.push('---');
    frontmatterLines.push('');

    return frontmatterLines.join('\n') + content;
  }

  /**
   * Determine output path for note
   */
  private getOutputPath(filename: string, customPath?: string): string {
    if (customPath) {
      return normalizePath(customPath.endsWith('.md') ? customPath : `${customPath}/${filename}`);
    }

    // Use template location by default
    return normalizePath(`${this.settings.templateLocation}/${filename}`);
  }

  /**
   * Ensure directory exists for a file path
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const normalizedPath = normalizePath(filePath);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    if (lastSlashIndex === -1) {
      return; // No directory to create
    }

    const dirPath = normalizedPath.substring(0, lastSlashIndex);
    
    try {
      await this.app.vault.createFolder(dirPath);
    } catch (error) {
      // Folder might already exist, which is fine
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already exists')) {
        console.warn(`Could not create directory ${dirPath}:`, error);
      }
    }
  }
}