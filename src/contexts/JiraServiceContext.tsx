import React, { createContext, useContext, ReactNode } from 'react';
import { JiraApiService } from '../services/jiraApiService';
import JiraDashboardPlugin from '../main';

interface JiraServiceContextType {
  jiraService: JiraApiService;
  plugin: JiraDashboardPlugin;
}

const JiraServiceContext = createContext<JiraServiceContextType | null>(null);

interface JiraServiceProviderProps {
  children: ReactNode;
  plugin: JiraDashboardPlugin;
}

export const JiraServiceProvider: React.FC<JiraServiceProviderProps> = ({ 
  children, 
  plugin 
}) => {
  return (
    <JiraServiceContext.Provider value={{ jiraService: plugin.jiraService, plugin }}>
      {children}
    </JiraServiceContext.Provider>
  );
};

export const useJiraService = (): JiraServiceContextType => {
  const context = useContext(JiraServiceContext);
  if (!context) {
    throw new Error('useJiraService must be used within a JiraServiceProvider');
  }
  return context;
};
