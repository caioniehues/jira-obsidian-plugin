import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useJiraService } from '../contexts/JiraServiceContext';
import { 
  JiraIssue, 
  JiraProject, 
  JiraUser, 
  JiraSearchResult,
  JiraSearchParams,
  JiraTransition,
  JiraTransitionRequest,
  IssueKey,
  createIssueKey
} from '../services/types';

// Transform JIRA issue to our dashboard format
const transformJiraIssue = (issue: JiraIssue) => ({
  id: issue.id,
  key: issue.key,
  summary: issue.fields.summary,
  description: issue.fields.description,
  status: issue.fields.status.name,
  priority: issue.fields.priority.name,
  assignee: issue.fields.assignee ? {
    displayName: issue.fields.assignee.displayName,
    avatarUrls: issue.fields.assignee.avatarUrls
  } : undefined,
  reporter: issue.fields.reporter ? {
    displayName: issue.fields.reporter.displayName
  } : undefined,
  created: issue.fields.created,
  updated: issue.fields.updated,
  labels: issue.fields.labels,
  issueType: {
    name: issue.fields.issuetype.name,
    iconUrl: issue.fields.issuetype.iconUrl
  }
});

export const useJiraIssues = (searchParams: JiraSearchParams) => {
  const { jiraService } = useJiraService();
  
  return useQuery({
    queryKey: ['jira-issues', searchParams],
    queryFn: async () => {
      const result = await jiraService.searchIssues(searchParams);
      return {
        ...result,
        issues: result.issues.map(transformJiraIssue)
      };
    },
    enabled: !!searchParams.jql,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useJiraProjects = () => {
  const { jiraService } = useJiraService();
  
  return useQuery({
    queryKey: ['jira-projects'],
    queryFn: async () => {
      return await jiraService.getProjects();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useJiraUser = () => {
  const { jiraService } = useJiraService();
  
  return useQuery({
    queryKey: ['jira-current-user'],
    queryFn: async () => {
      return await jiraService.getCurrentUser();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

export const useJiraTransitions = (issueKey: string) => {
  const { jiraService } = useJiraService();
  
  return useQuery({
    queryKey: ['jira-transitions', issueKey],
    queryFn: async () => {
      return await jiraService.getTransitions(createIssueKey(issueKey));
    },
    enabled: !!issueKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateJiraIssue = () => {
  const { jiraService } = useJiraService();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueKey, updateData }: { issueKey: string; updateData: any }) => {
      return await jiraService.updateIssue(createIssueKey(issueKey), updateData);
    },
    onSuccess: () => {
      // Invalidate and refetch issues
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
    },
  });
};

export const useTransitionJiraIssue = () => {
  const { jiraService } = useJiraService();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ issueKey, transitionRequest }: { issueKey: string; transitionRequest: JiraTransitionRequest }) => {
      return await jiraService.transitionIssue(createIssueKey(issueKey), transitionRequest);
    },
    onSuccess: () => {
      // Invalidate and refetch issues
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
    },
  });
};

export const useCreateJiraIssue = () => {
  const { jiraService } = useJiraService();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (issueData: any) => {
      return await jiraService.createIssue(issueData);
    },
    onSuccess: () => {
      // Invalidate and refetch issues
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
    },
  });
};

export const useBatchUpdateJiraIssues = () => {
  const { jiraService } = useJiraService();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (issueUpdates: Array<{ issueIdOrKey: string; updateData: any }>) => {
      return await jiraService.batchUpdateIssues(
        issueUpdates.map(update => ({
          issueIdOrKey: createIssueKey(update.issueIdOrKey),
          updateData: update.updateData
        }))
      );
    },
    onSuccess: () => {
      // Invalidate and refetch issues
      queryClient.invalidateQueries({ queryKey: ['jira-issues'] });
    },
  });
};
