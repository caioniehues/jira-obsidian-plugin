import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JiraDashboardPlugin from '../main';
import { TaskCard } from './TaskCard';
import { FilterBar } from './FilterBar';
import { StatusColumn } from './StatusColumn';
import { JiraConfiguration } from './JiraConfiguration';
import { Spinner } from './ui/spinner';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useJiraIssues, useJiraUser } from '../hooks/useJiraOperations';
import { useJiraService } from '../contexts/JiraServiceContext';

interface JiraDashboardProps {
  plugin: JiraDashboardPlugin;
}

export interface JiraTask {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: {
    displayName: string;
    avatarUrls: {
      '48x48': string;
    };
  };
  reporter?: {
    displayName: string;
  };
  created: string;
  updated: string;
  duedate?: string;
  labels: string[];
  issueType: {
    name: string;
    iconUrl: string;
  };
}

export const JiraDashboard: React.FC<JiraDashboardProps> = ({ plugin }) => {
  const { jiraService } = useJiraService();
  const [filterQuery, setFilterQuery] = useState('assignee = currentUser() AND status != Done ORDER BY priority DESC');
  const [groupBy, setGroupBy] = useState<'status' | 'priority' | 'assignee'>('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfiguration, setShowConfiguration] = useState(false);

  // Check if JIRA is configured
  const { data: currentUser, isLoading: userLoading, error: userError } = useJiraUser();

  // Fetch tasks from Jira API
  const { data: searchResult, isLoading, error, refetch } = useJiraIssues({
    jql: filterQuery,
    startAt: 0,
    maxResults: 100
  });

  const tasks = searchResult?.issues || [];

  // Filter tasks based on search term
  const filteredTasks = tasks?.filter(task => 
    task.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.labels.some(label => label.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Group tasks based on selected grouping
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, JiraTask[]> = {};
    
    filteredTasks.forEach(task => {
      let groupKey = '';
      
      switch (groupBy) {
        case 'status':
          groupKey = task.status;
          break;
        case 'priority':
          groupKey = task.priority;
          break;
        case 'assignee':
          groupKey = task.assignee?.displayName || 'Unassigned';
          break;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });
    
    return groups;
  }, [filteredTasks, groupBy]);

  // Handle task status update
  const handleTaskStatusUpdate = async (taskKey: string, newStatus: string) => {
    try {
      // This will call JiraService.updateTask
      console.log(`Updating task ${taskKey} to status ${newStatus}`);
      // Refetch tasks after update
      await refetch();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // Show configuration if JIRA is not configured or user loading failed
  if (userError || (!userLoading && !currentUser)) {
    return (
      <div className="jira-dashboard p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                JIRA Configuration Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Please configure your JIRA connection to start using the dashboard.
              </p>
              <Button onClick={() => setShowConfiguration(true)}>
                Configure JIRA
              </Button>
            </CardContent>
          </Card>
          
          {showConfiguration && (
            <JiraConfiguration />
          )}
        </div>
      </div>
    );
  }

  if (userLoading || isLoading) {
    return (
      <div className="jira-dashboard flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner variant="ring" size={48} className="text-primary" />
          <p className="text-muted-foreground">
            {userLoading ? 'Connecting to JIRA...' : 'Loading tasks...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jira-dashboard p-6">
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertTitle>Failed to load tasks</AlertTitle>
          <AlertDescription className="mt-2">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </AlertDescription>
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="sm"
            >
              Retry
            </Button>
            <Button 
              onClick={() => setShowConfiguration(true)} 
              variant="outline" 
              size="sm"
            >
              Reconfigure JIRA
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="jira-dashboard p-6">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Jira Dashboard</CardTitle>
            {currentUser && (
              <p className="text-sm text-muted-foreground mt-1">
                Welcome, {currentUser.displayName}
              </p>
            )}
          </div>
          <div className="header-actions flex gap-2">
            <Button 
              onClick={() => setShowConfiguration(true)}
              variant="outline"
              size="sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Button>
            <Button 
              onClick={() => refetch()}
              variant="outline"
              size="sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {showConfiguration && (
        <div className="mb-6">
          <JiraConfiguration />
        </div>
      )}

      <FilterBar
        onFilterChange={setFilterQuery}
        onGroupByChange={setGroupBy}
        onSearchChange={setSearchTerm}
        currentFilter={filterQuery}
        currentGroupBy={groupBy}
        searchTerm={searchTerm}
      />

      <div className="dashboard-content">
        {groupBy === 'status' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Object.entries(groupedTasks).map(([status, tasks]) => (
              <StatusColumn
                key={status}
                title={status}
                tasks={tasks}
                onTaskMove={handleTaskStatusUpdate}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([group, tasks]) => (
              <Card key={group}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{group}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {tasks.length} tasks
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {tasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="mt-6">
        <CardContent className="py-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredTasks.length} tasks
          </span>
          <span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

