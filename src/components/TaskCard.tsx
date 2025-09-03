import React from 'react';
import { JiraTask } from './JiraDashboard';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: JiraTask;
  onStatusChange?: (newStatus: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange: _onStatusChange }) => {
  const getPriorityVariant = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'highest':
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="cursor-move hover:shadow-lg transition-shadow" draggable>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={task.issueType.iconUrl} 
              alt={task.issueType.name} 
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-muted-foreground">
              {task.key}
            </span>
          </div>
          <Badge 
            variant={getPriorityVariant(task.priority) as any}
            className="text-xs"
          >
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-3">
        <h4 className="font-semibold text-sm mb-2 line-clamp-2">
          {task.summary}
        </h4>
        
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {task.description}
          </p>
        )}
        
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.map(label => (
              <Badge 
                key={label} 
                variant="secondary"
                className="text-xs"
              >
                {label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {task.assignee && (
              <>
                <img 
                  src={task.assignee.avatarUrls['48x48']} 
                  alt={task.assignee.displayName}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-xs text-muted-foreground">
                  {task.assignee.displayName}
                </span>
              </>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <span title={`Updated: ${new Date(task.updated).toLocaleString()}`}>
              {formatDate(task.updated)}
            </span>
            {task.duedate && (
              <span 
                className={cn(
                  "font-medium",
                  new Date(task.duedate) < new Date() && "text-destructive"
                )}
                title={`Due: ${new Date(task.duedate).toLocaleString()}`}
              >
                Due: {formatDate(task.duedate)}
              </span>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};