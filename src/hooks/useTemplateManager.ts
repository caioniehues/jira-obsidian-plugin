/**
 * React Hook for Template Manager
 * 
 * Provides React components with template management functionality.
 */

import { useState, useCallback, useEffect } from 'react';
import { App } from 'obsidian';
import { TemplateManager } from '../templates/TemplateManager';
import { TemplateSettings, NoteCreationOptions, CreatedNote } from '../templates/types';
import { JiraIssue } from '../services/types';

interface UseTemplateManagerResult {
  templateManager: TemplateManager | null;
  settings: TemplateSettings | null;
  availableTemplates: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createNoteForIssue: (issue: JiraIssue, options?: NoteCreationOptions) => Promise<CreatedNote>;
  updateSettings: (newSettings: Partial<TemplateSettings>) => void;
  saveCustomTemplate: (name: string, content: string, saveToVault?: boolean) => Promise<void>;
  deleteTemplate: (name: string) => Promise<void>;
  previewTemplate: (content: string) => Promise<string>;
  validateTemplate: (content: string) => { isValid: boolean; errors: string[] };
  refreshTemplates: () => Promise<void>;
}

export function useTemplateManager(app: App | null): UseTemplateManagerResult {
  const [templateManager, setTemplateManager] = useState<TemplateManager | null>(null);
  const [settings, setSettings] = useState<TemplateSettings | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize template manager
  useEffect(() => {
    if (!app) return;

    try {
      const manager = new TemplateManager(app);
      setTemplateManager(manager);
      setSettings(manager.getSettings());
      setError(null);
    } catch (err) {
      console.error('Failed to initialize template manager:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize template manager');
    }
  }, [app]);

  // Load available templates
  const refreshTemplates = useCallback(async () => {
    if (!templateManager) return;

    try {
      setIsLoading(true);
      const templates = await templateManager.getAvailableTemplates();
      setAvailableTemplates(templates);
      setError(null);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [templateManager]);

  // Initial template loading
  useEffect(() => {
    if (templateManager) {
      refreshTemplates();
    }
  }, [templateManager, refreshTemplates]);

  // Create note for issue
  const createNoteForIssue = useCallback(async (
    issue: JiraIssue, 
    options: NoteCreationOptions = {}
  ): Promise<CreatedNote> => {
    if (!templateManager) {
      throw new Error('Template manager not initialized');
    }

    try {
      const note = await templateManager.createNoteForIssue(issue, options);
      return note;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [templateManager]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<TemplateSettings>) => {
    if (!templateManager) return;

    try {
      templateManager.updateSettings(newSettings);
      setSettings(templateManager.getSettings());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [templateManager]);

  // Save custom template
  const saveCustomTemplate = useCallback(async (
    name: string, 
    content: string, 
    saveToVault = true
  ) => {
    if (!templateManager) {
      throw new Error('Template manager not initialized');
    }

    try {
      await templateManager.saveCustomTemplate(name, content, saveToVault);
      await refreshTemplates(); // Refresh the list
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [templateManager, refreshTemplates]);

  // Delete template
  const deleteTemplate = useCallback(async (name: string) => {
    if (!templateManager) {
      throw new Error('Template manager not initialized');
    }

    try {
      await templateManager.deleteTemplate(name);
      await refreshTemplates(); // Refresh the list
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [templateManager, refreshTemplates]);

  // Preview template
  const previewTemplate = useCallback(async (content: string): Promise<string> => {
    if (!templateManager) {
      throw new Error('Template manager not initialized');
    }

    try {
      const preview = await templateManager.previewTemplate(content);
      setError(null);
      return preview;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview template';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [templateManager]);

  // Validate template
  const validateTemplate = useCallback((content: string) => {
    if (!templateManager) {
      return { isValid: false, errors: ['Template manager not initialized'] };
    }

    return templateManager.validateTemplate(content);
  }, [templateManager]);

  return {
    templateManager,
    settings,
    availableTemplates,
    isLoading,
    error,
    createNoteForIssue,
    updateSettings,
    saveCustomTemplate,
    deleteTemplate,
    previewTemplate,
    validateTemplate,
    refreshTemplates,
  };
}