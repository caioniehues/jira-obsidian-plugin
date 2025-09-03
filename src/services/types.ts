/**
 * JIRA API Service Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for JIRA entities
 * and API interactions, following TDD, KISS, and DRY principles.
 */

// Branded types for type safety
export type IssueKey = string & { readonly __brand: 'IssueKey' };
export type ProjectKey = string & { readonly __brand: 'ProjectKey' };
export type UserId = string & { readonly __brand: 'UserId' };

// Helper functions to create branded types
export const createIssueKey = (key: string): IssueKey => key as IssueKey;
export const createProjectKey = (key: string): ProjectKey => key as ProjectKey;
export const createUserId = (id: string): UserId => id as UserId;

// Base JIRA entity interfaces
export interface JiraIssue {
  id: string;
  key: IssueKey;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee?: JiraUser;
    reporter: JiraUser;
    created: string;
    updated: string;
    project: JiraProject;
    issuetype: JiraIssueType;
    labels: string[];
    components: JiraComponent[];
    fixVersions: JiraVersion[];
    customfield_10016?: number; // Story points
  };
}

export interface JiraProject {
  id: string;
  key: ProjectKey;
  name: string;
  projectTypeKey: string;
  self: string;
  description?: string;
  lead: JiraUser;
  assigneeType: string;
  versions: JiraVersion[];
  components: JiraComponent[];
  issueTypes: JiraIssueType[];
  roles: Record<string, string>;
}

export interface JiraUser {
  accountId: UserId;
  accountType: string;
  active: boolean;
  displayName: string;
  emailAddress?: string;
  self: string;
  timeZone?: string;
  avatarUrls: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
}

export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl: string;
  self: string;
  statusCategory: {
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
  self: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl: string;
  self: string;
  subtask: boolean;
  avatarId?: number;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  self: string;
  assignee?: JiraUser;
  assigneeType: string;
  realAssignee?: JiraUser;
  realAssigneeType: string;
  isAssigneeTypeValid: boolean;
  project: string;
  projectId: number;
}

export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  released: boolean;
  releaseDate?: string;
  self: string;
  projectId: number;
  startDate?: string;
  userStartDate?: string;
  userReleaseDate?: string;
}

// Search and pagination interfaces
export interface JiraSearchResult {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraSearchParams {
  jql: string;
  startAt?: number;
  maxResults?: number;
  fields?: string[];
  expand?: string[];
}

// Transition interfaces
export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isAvailable: boolean;
  isConditional: boolean;
  isLooped: boolean;
}

export interface JiraTransitionRequest {
  transition: {
    id: string;
  };
  fields?: Record<string, any>;
  update?: Record<string, any[]>;
  historyMetadata?: {
    type: string;
    description: string;
    descriptionKey: string;
    activityDescription: string;
    activityDescriptionKey: string;
    emailDescription: string;
    emailDescriptionKey: string;
    actor: {
      id: string;
      displayName: string;
      type: string;
      avatarUrl: string;
    };
    generator: {
      id: string;
      displayName: string;
      type: string;
      avatarUrl: string;
    };
    cause: {
      id: string;
      displayName: string;
      type: string;
      avatarUrl: string;
    };
    extraData: Record<string, string>;
  };
}

// API response interfaces
export interface JiraApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Configuration interfaces
export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  timeout?: number;
  maxRetries?: number;
}

// Error type definitions
export interface JiraApiError {
  type: 'JIRA_API_ERROR';
  status: number;
  statusText: string;
  message: string;
  errorMessages?: string[];
  errors?: Record<string, string>;
  timestamp: string;
  requestId?: string;
}

export interface NetworkError {
  type: 'NETWORK_ERROR';
  message: string;
  code?: string;
  cause?: Error;
  timestamp: string;
  url?: string;
}

export interface AuthenticationError {
  type: 'AUTHENTICATION_ERROR';
  message: string;
  status: number;
  timestamp: string;
  requestId?: string;
}

export interface RateLimitError {
  type: 'RATE_LIMIT_ERROR';
  message: string;
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  resetTime?: string;
  timestamp: string;
  queueSize?: number;
  burstLimit?: number;
}

export interface ValidationError {
  type: 'VALIDATION_ERROR';
  message: string;
  field?: string;
  value?: any;
  timestamp: string;
}

export type JiraServiceError = 
  | JiraApiError 
  | NetworkError 
  | AuthenticationError 
  | RateLimitError 
  | ValidationError;
