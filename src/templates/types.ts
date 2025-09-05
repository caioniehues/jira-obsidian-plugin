/**
 * Template System Types
 * 
 * Type definitions for the template engine and related functionality.
 */

export interface TemplateSettings {
  defaultTemplate: string;
  customTemplates: Record<string, string>;
  templateLocation: string;
  dateFormat: string;
  includeComments: boolean;
  includeWorklog: boolean;
  customFieldMappings: Record<string, string>;
}

export interface TemplatePreviewData {
  template: string;
  previewContent: string;
  variables: TemplateVariable[];
  errors: string[];
}

export interface TemplateVariable {
  key: string;
  description: string;
  example: string;
  category: 'basic' | 'dates' | 'people' | 'project' | 'custom';
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NoteCreationOptions {
  templateName?: string;
  customTemplate?: string;
  outputPath?: string;
  openAfterCreation?: boolean;
  replaceExisting?: boolean;
}

export interface CreatedNote {
  path: string;
  filename: string;
  content: string;
  frontmatter: Record<string, any>;
  issue: {
    key: string;
    summary: string;
  };
}