/**
 * Template Engine for JIRA Issues
 * 
 * Processes JIRA data into markdown templates with variable substitution
 * and frontmatter generation for Obsidian metadata.
 */

import { JiraIssue, JiraUser, JiraStatus, JiraPriority, JiraComponent, JiraVersion } from '../services/types';
import moment from 'moment';

export interface TemplateVariable {
  key: string;
  description: string;
  example: string;
  category: 'basic' | 'dates' | 'people' | 'project' | 'custom';
}

export interface TemplateConfig {
  templatePath?: string;
  customFields?: Record<string, string>;
  includeComments?: boolean;
  includeWorklog?: boolean;
  dateFormat?: string;
}

export interface ProcessedTemplate {
  content: string;
  frontmatter: Record<string, any>;
  filename: string;
}

export class TemplateEngine {
  private readonly defaultTemplate = `---
jira-key: {{key}}
title: "{{key}}: {{summary}}"
status: {{status}}
priority: {{priority}}
assignee: {{assignee.displayName}}
reporter: {{reporter.displayName}}
created: {{created}}
updated: {{updated}}
project: {{project.name}}
issue-type: {{issuetype.name}}
labels: [{{#each labels}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]
components: [{{#each components}}"{{this.name}}"{{#unless @last}}, {{/unless}}{{/each}}]
---

# {{key}}: {{summary}}

## Description
{{#if description}}
{{description}}
{{else}}
_No description provided_
{{/if}}

## Details
- **Status**: {{status.name}} ({{status.statusCategory.name}})
- **Priority**: {{priority.name}}
- **Issue Type**: {{issuetype.name}}
- **Project**: {{project.name}} ({{project.key}})
- **Assignee**: {{#if assignee}}{{assignee.displayName}}{{else}}_Unassigned_{{/if}}
- **Reporter**: {{reporter.displayName}}
- **Created**: {{created_formatted}}
- **Updated**: {{updated_formatted}}

{{#if labels.length}}
## Labels
{{#each labels}}
- {{this}}
{{/each}}
{{/if}}

{{#if components.length}}
## Components
{{#each components}}
- {{this.name}}{{#if this.description}} - {{this.description}}{{/if}}
{{/each}}
{{/if}}

{{#if fixVersions.length}}
## Fix Versions
{{#each fixVersions}}
- {{this.name}}{{#if this.releaseDate}} (Release: {{this.releaseDate}}){{/if}}
{{/each}}
{{/if}}

{{#if customfield_10016}}
## Story Points
{{customfield_10016}}
{{/if}}

## Links
- [View in JIRA]({{self}})
- [Project]({{project.self}})

## Notes
<!-- Add your notes here -->

## Comments
{{#if comments}}
{{#each comments}}
### {{author.displayName}} - {{created_formatted}}
{{body}}

{{/each}}
{{else}}
_No comments yet_
{{/if}}

{{#if includeWorklog}}
## Work Log
<!-- Work log entries will be populated here -->
{{/if}}
`;

  private readonly availableVariables: TemplateVariable[] = [
    // Basic fields
    { key: 'key', description: 'Issue key (e.g., PROJ-123)', example: 'PROJ-123', category: 'basic' },
    { key: 'id', description: 'Issue ID', example: '10001', category: 'basic' },
    { key: 'summary', description: 'Issue summary/title', example: 'Fix login bug', category: 'basic' },
    { key: 'description', description: 'Issue description', example: 'User cannot log in...', category: 'basic' },
    { key: 'self', description: 'JIRA issue URL', example: 'https://company.atlassian.net/rest/api/2/issue/10001', category: 'basic' },
    
    // Status and priority
    { key: 'status', description: 'Current status object', example: '{name: "In Progress", ...}', category: 'basic' },
    { key: 'status.name', description: 'Status name', example: 'In Progress', category: 'basic' },
    { key: 'status.statusCategory.name', description: 'Status category', example: 'In Progress', category: 'basic' },
    { key: 'priority', description: 'Priority object', example: '{name: "High", ...}', category: 'basic' },
    { key: 'priority.name', description: 'Priority name', example: 'High', category: 'basic' },
    
    // People
    { key: 'assignee', description: 'Assignee object (may be null)', example: '{displayName: "John Doe", ...}', category: 'people' },
    { key: 'assignee.displayName', description: 'Assignee display name', example: 'John Doe', category: 'people' },
    { key: 'assignee.emailAddress', description: 'Assignee email', example: 'john@company.com', category: 'people' },
    { key: 'reporter', description: 'Reporter object', example: '{displayName: "Jane Smith", ...}', category: 'people' },
    { key: 'reporter.displayName', description: 'Reporter display name', example: 'Jane Smith', category: 'people' },
    { key: 'reporter.emailAddress', description: 'Reporter email', example: 'jane@company.com', category: 'people' },
    
    // Dates
    { key: 'created', description: 'Creation date (ISO format)', example: '2024-01-15T10:30:00.000Z', category: 'dates' },
    { key: 'updated', description: 'Last update date (ISO format)', example: '2024-01-16T14:20:00.000Z', category: 'dates' },
    { key: 'created_formatted', description: 'Formatted creation date', example: 'January 15, 2024', category: 'dates' },
    { key: 'updated_formatted', description: 'Formatted update date', example: 'January 16, 2024', category: 'dates' },
    
    // Project and structure
    { key: 'project', description: 'Project object', example: '{name: "My Project", key: "PROJ"}', category: 'project' },
    { key: 'project.name', description: 'Project name', example: 'My Project', category: 'project' },
    { key: 'project.key', description: 'Project key', example: 'PROJ', category: 'project' },
    { key: 'project.description', description: 'Project description', example: 'Main development project', category: 'project' },
    { key: 'issuetype', description: 'Issue type object', example: '{name: "Bug", ...}', category: 'project' },
    { key: 'issuetype.name', description: 'Issue type name', example: 'Bug', category: 'project' },
    { key: 'labels', description: 'Array of labels', example: '["backend", "urgent"]', category: 'project' },
    { key: 'components', description: 'Array of components', example: '[{name: "API", ...}]', category: 'project' },
    { key: 'fixVersions', description: 'Array of fix versions', example: '[{name: "v1.2.0", ...}]', category: 'project' },
    
    // Custom fields
    { key: 'customfield_10016', description: 'Story points (common custom field)', example: '5', category: 'custom' },
  ];

  constructor(private config: TemplateConfig = {}) {}

  /**
   * Get all available template variables
   */
  getAvailableVariables(): TemplateVariable[] {
    return [...this.availableVariables];
  }

  /**
   * Get variables by category
   */
  getVariablesByCategory(category: TemplateVariable['category']): TemplateVariable[] {
    return this.availableVariables.filter(v => v.category === category);
  }

  /**
   * Process a JIRA issue using the default or custom template
   */
  async processIssue(issue: JiraIssue, customTemplate?: string): Promise<ProcessedTemplate> {
    const template = customTemplate || this.defaultTemplate;
    const templateData = this.prepareTemplateData(issue);
    
    // Process the template content
    const content = this.processTemplate(template, templateData);
    
    // Generate frontmatter
    const frontmatter = this.generateFrontmatter(issue);
    
    // Generate filename
    const filename = this.generateFilename(issue);
    
    return {
      content,
      frontmatter,
      filename
    };
  }

  /**
   * Prepare data object for template processing
   */
  private prepareTemplateData(issue: JiraIssue): Record<string, any> {
    const dateFormat = this.config.dateFormat || 'MMMM DD, YYYY';
    
    return {
      ...issue,
      ...issue.fields,
      // Formatted dates
      created_formatted: this.formatDate(issue.fields.created, dateFormat),
      updated_formatted: this.formatDate(issue.fields.updated, dateFormat),
      // Helper flags
      includeComments: this.config.includeComments || false,
      includeWorklog: this.config.includeWorklog || false,
      // Custom field mappings
      ...this.config.customFields,
    };
  }

  /**
   * Process template with variable substitution
   * Simple implementation - can be enhanced with Handlebars.js for complex logic
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;

    // Handle simple variable substitution {{variable}}
    processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getNestedValue(data, trimmedPath);
      return value != null ? String(value) : '';
    });

    // Handle conditional blocks {{#if condition}}...{{/if}}
    processed = this.processConditionals(processed, data);

    // Handle each blocks {{#each array}}...{{/each}}
    processed = this.processEachBlocks(processed, data);

    return processed;
  }

  /**
   * Process conditional blocks in templates
   */
  private processConditionals(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const value = this.getNestedValue(data, condition.trim());
      const isTrue = value && (Array.isArray(value) ? value.length > 0 : true);
      return isTrue ? content : '';
    });
  }

  /**
   * Process each blocks in templates
   */
  private processEachBlocks(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayPath, itemTemplate) => {
      const array = this.getNestedValue(data, arrayPath.trim());
      if (!Array.isArray(array) || array.length === 0) {
        return '';
      }

      return array.map((item, index) => {
        let processed = itemTemplate;
        // Replace {{this}} with current item
        processed = processed.replace(/\{\{this\}\}/g, String(item));
        // Replace {{this.property}} with item properties
        processed = processed.replace(/\{\{this\.([^}]+)\}\}/g, (subMatch: string, prop: string) => {
          const value = item && typeof item === 'object' ? item[prop] : '';
          return value != null ? String(value) : '';
        });
        // Handle {{#unless @last}} for separators
        processed = processed.replace(/\{\{#unless @last\}\}([^{]*)\{\{\/unless\}\}/g, (subMatch: string, separator: string) => {
          return index < array.length - 1 ? separator : '';
        });
        return processed;
      }).join('');
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : null;
    }, obj);
  }

  /**
   * Generate frontmatter for Obsidian
   */
  private generateFrontmatter(issue: JiraIssue): Record<string, any> {
    const frontmatter: Record<string, any> = {
      'jira-key': issue.key,
      'title': `${issue.key}: ${issue.fields.summary}`,
      'status': issue.fields.status.name,
      'priority': issue.fields.priority.name,
      'created': issue.fields.created,
      'updated': issue.fields.updated,
      'project': issue.fields.project.name,
      'issue-type': issue.fields.issuetype.name,
    };

    // Add assignee if present
    if (issue.fields.assignee) {
      frontmatter.assignee = issue.fields.assignee.displayName;
    }

    // Add reporter
    frontmatter.reporter = issue.fields.reporter.displayName;

    // Add labels if present
    if (issue.fields.labels && issue.fields.labels.length > 0) {
      frontmatter.labels = issue.fields.labels;
    }

    // Add components if present
    if (issue.fields.components && issue.fields.components.length > 0) {
      frontmatter.components = issue.fields.components.map(c => c.name);
    }

    // Add story points if present
    if (issue.fields.customfield_10016) {
      frontmatter['story-points'] = issue.fields.customfield_10016;
    }

    // Add custom fields from config
    if (this.config.customFields) {
      Object.entries(this.config.customFields).forEach(([key, fieldName]) => {
        const value = this.getNestedValue(issue.fields, fieldName);
        if (value != null) {
          frontmatter[key] = value;
        }
      });
    }

    return frontmatter;
  }

  /**
   * Generate a filename for the issue note
   */
  private generateFilename(issue: JiraIssue): string {
    // Sanitize the summary for filename
    const sanitizedSummary = issue.fields.summary
      .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50); // Limit length

    return `${issue.key}-${sanitizedSummary}.md`;
  }

  /**
   * Format date using moment (Obsidian's built-in date library)
   */
  private formatDate(dateString: string, format: string): string {
    try {
      return moment(dateString).format(format);
    } catch (error) {
      console.warn('Failed to format date:', dateString, error);
      return dateString;
    }
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for balanced braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced template braces');
    }

    // Check for balanced conditionals
    const ifBlocks = (template.match(/\{\{#if/g) || []).length;
    const endIfBlocks = (template.match(/\{\{\/if\}\}/g) || []).length;
    if (ifBlocks !== endIfBlocks) {
      errors.push('Unbalanced if/endif blocks');
    }

    // Check for balanced each blocks
    const eachBlocks = (template.match(/\{\{#each/g) || []).length;
    const endEachBlocks = (template.match(/\{\{\/each\}\}/g) || []).length;
    if (eachBlocks !== endEachBlocks) {
      errors.push('Unbalanced each/endeach blocks');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get the default template
   */
  getDefaultTemplate(): string {
    return this.defaultTemplate;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TemplateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}