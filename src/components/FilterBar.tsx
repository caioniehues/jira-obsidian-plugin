import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Card, CardContent } from './ui/card';

interface FilterBarProps {
  onFilterChange: (filter: string) => void;
  onGroupByChange: (groupBy: 'status' | 'priority' | 'assignee') => void;
  onSearchChange: (search: string) => void;
  currentFilter: string;
  currentGroupBy: 'status' | 'priority' | 'assignee';
  searchTerm: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  onGroupByChange,
  onSearchChange,
  currentFilter,
  currentGroupBy,
  searchTerm
}) => {
  const [customJql, setCustomJql] = useState(currentFilter);
  const [isCustomMode, setIsCustomMode] = useState(false);

  const presetFilters = [
    { label: 'My Open Tasks', jql: 'assignee = currentUser() AND status != Done ORDER BY priority DESC' },
    { label: 'High Priority', jql: 'priority in (Highest, High) AND status != Done ORDER BY updated DESC' },
    { label: 'Due This Week', jql: 'duedate <= endOfWeek() AND status != Done ORDER BY duedate ASC' },
    { label: 'Recently Updated', jql: 'updated >= -7d ORDER BY updated DESC' },
    { label: 'Blocked Tasks', jql: 'status = Blocked OR labels in (blocked, impediment)' },
    { label: 'All Tasks', jql: 'ORDER BY created DESC' }
  ];

  const handlePresetSelect = (jql: string) => {
    setCustomJql(jql);
    setIsCustomMode(false);
    onFilterChange(jql);
  };

  const handleCustomJqlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(customJql);
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="w-64">
              <Select
                value={isCustomMode ? 'custom' : currentFilter}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setIsCustomMode(true);
                  } else {
                    handlePresetSelect(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a filter" />
                </SelectTrigger>
                <SelectContent>
                  {presetFilters.map(filter => (
                    <SelectItem key={filter.jql} value={filter.jql}>
                      {filter.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom JQL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCustomMode && (
            <div className="flex gap-2">
              <form onSubmit={handleCustomJqlSubmit} className="flex gap-2 flex-1">
                <Input
                  type="text"
                  placeholder="Enter JQL query..."
                  value={customJql}
                  onChange={(e) => setCustomJql(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="default" size="sm">
                  Apply
                </Button>
                <Button 
                  type="button" 
                  onClick={() => setIsCustomMode(false)} 
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </form>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Group by:</span>
            <div className="flex gap-1">
              <Button
                variant={currentGroupBy === 'status' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupByChange('status')}
              >
                Status
              </Button>
              <Button
                variant={currentGroupBy === 'priority' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupByChange('priority')}
              >
                Priority
              </Button>
              <Button
                variant={currentGroupBy === 'assignee' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onGroupByChange('assignee')}
              >
                Assignee
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};