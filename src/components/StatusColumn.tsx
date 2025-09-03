import React from 'react';
import { JiraTask } from './JiraDashboard';
import { TaskCard } from './TaskCard';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface StatusColumnProps {
  title: string;
  tasks: JiraTask[];
  onTaskMove: (taskKey: string, newStatus: string) => void;
}

export const StatusColumn: React.FC<StatusColumnProps> = ({ title, tasks, onTaskMove }) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const taskKey = e.dataTransfer.getData('taskKey');
    if (taskKey) {
      onTaskMove(taskKey, title);
    }
  };

  const handleDragStart = (e: React.DragEvent, task: JiraTask) => {
    e.dataTransfer.setData('taskKey', task.key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const getStatusVariant = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('closed')) return 'success';
    if (statusLower.includes('progress') || statusLower.includes('review')) return 'info';
    if (statusLower.includes('blocked')) return 'destructive';
    if (statusLower.includes('todo') || statusLower.includes('backlog')) return 'secondary';
    return 'warning';
  };

  return (
    <div 
      className={cn(
        "flex flex-col bg-muted/30 rounded-lg p-4 min-w-[300px] max-w-[400px]",
        "transition-colors duration-200"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge 
            variant={getStatusVariant(title) as any}
            className="text-xs px-2 py-0.5"
          >
            {title}
          </Badge>
          <span className="text-sm text-muted-foreground font-medium">
            {tasks.length}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <div 
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
            >
              <TaskCard task={task} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};