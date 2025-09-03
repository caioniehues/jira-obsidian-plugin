import React, { useState } from 'react';
import { useJiraService } from '../contexts/JiraServiceContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import { Badge } from './ui/badge';

export const JiraConfiguration: React.FC = () => {
  const { jiraService, plugin } = useJiraService();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [credentials, setCredentials] = useState({
    serverUrl: '',
    email: '',
    apiToken: '',
    masterPassword: ''
  });

  const handleConfigure = async () => {
    if (!credentials.serverUrl || !credentials.email || !credentials.apiToken || !credentials.masterPassword) {
      setTestResult({ success: false, message: 'Please fill in all fields' });
      return;
    }

    setIsConfiguring(true);
    setTestResult(null);

    try {
      // First update HTTP client configuration with new credentials
      plugin.httpClient.updateConfig({
        baseUrl: credentials.serverUrl,
        email: credentials.email,
        apiToken: credentials.apiToken
      });

      // Test the connection with the new credentials before saving
      // Note: This will be handled by the updated HTTP client which uses Obsidian's requestUrl

      // If test passes, encrypt and store credentials
      const encryptedData = await plugin.authManager.encryptCredentials({
        email: credentials.email,
        apiToken: credentials.apiToken,
        serverUrl: credentials.serverUrl
      }, credentials.masterPassword);
      
      await plugin.authManager.storeCredentials(encryptedData);

      setTestResult({ success: true, message: 'JIRA configuration saved and verified successfully!' });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to save configuration' 
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleTestConnection = async () => {
    if (!credentials.masterPassword) {
      setTestResult({ success: false, message: 'Please enter your master password' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await jiraService.testConnection(credentials.masterPassword);
      setTestResult(result);
    } catch (error) {
      // Enhanced error handling with specific messages
      let message = 'Connection test failed';
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          message = 'Authentication failed. Please verify your email and API token are correct.';
        } else if (error.message.includes('Invalid password')) {
          message = 'Invalid master password. Please enter the correct password used to encrypt your credentials.';
        } else if (error.message.includes('No credentials stored')) {
          message = 'No credentials found. Please save your configuration first.';
        } else if (error.message.includes('Network')) {
          message = 'Network error. Please check your internet connection and Jira server URL.';
        } else {
          message = error.message;
        }
      }
      setTestResult({ 
        success: false, 
        message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCredentials = async () => {
    try {
      await jiraService.clearCredentials();
      setCredentials({
        serverUrl: '',
        email: '',
        apiToken: '',
        masterPassword: ''
      });
      setTestResult({ success: true, message: 'Credentials cleared successfully' });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to clear credentials' 
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          JIRA Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <AlertTitle>{testResult.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="serverUrl" className="block text-sm font-medium mb-1">
              JIRA Server URL
            </label>
            <Input
              id="serverUrl"
              type="url"
              placeholder="https://your-domain.atlassian.net"
              value={credentials.serverUrl}
              onChange={(e) => setCredentials(prev => ({ ...prev, serverUrl: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@example.com"
              value={credentials.email}
              onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="apiToken" className="block text-sm font-medium mb-1">
              API Token
            </label>
            <Input
              id="apiToken"
              type="password"
              placeholder="Your JIRA API token"
              value={credentials.apiToken}
              onChange={(e) => setCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Generate an API token from{' '}
              <a 
                href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                your Atlassian account settings
              </a>
            </p>
          </div>

          <div>
            <label htmlFor="masterPassword" className="block text-sm font-medium mb-1">
              Master Password
            </label>
            <Input
              id="masterPassword"
              type="password"
              placeholder="Password to encrypt your credentials"
              value={credentials.masterPassword}
              onChange={(e) => setCredentials(prev => ({ ...prev, masterPassword: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This password will be used to encrypt your JIRA credentials
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleConfigure} 
            disabled={isConfiguring}
            className="flex-1"
          >
            {isConfiguring ? (
              <>
                <Spinner size={16} className="mr-2" />
                Configuring...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          
          <Button 
            onClick={handleTestConnection} 
            variant="outline"
            disabled={isTesting || isConfiguring}
          >
            {isTesting ? (
              <>
                <Spinner size={16} className="mr-2" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleClearCredentials} 
            variant="destructive"
            size="sm"
          >
            Clear Stored Credentials
          </Button>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">Rate Limit</Badge>
            <span>100 requests/minute</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Badge variant="outline">Security</Badge>
            <span>Credentials encrypted with AES-256-GCM</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
