# JIRA Dashboard Plugin for Obsidian

A powerful Obsidian plugin that integrates with JIRA Cloud to provide a beautiful, AI-powered task dashboard directly within your Obsidian workspace.

## ✨ Features

### 🔗 **Complete JIRA Integration**
- **Real-time JIRA API v3** integration with full REST API support
- **Secure Authentication** with AES-256-GCM encrypted credential storage
- **Rate Limiting** (100 requests/minute) with automatic handling
- **Request Deduplication** for optimal performance
- **Batch Operations** for efficient bulk processing

### 📊 **Beautiful Dashboard**
- **Kanban-style Board** with drag-and-drop functionality
- **Multiple View Modes** (status, priority, assignee grouping)
- **Advanced Filtering** with JQL support
- **Real-time Search** across issues, labels, and descriptions
- **Responsive Design** that works on all screen sizes

### 🛡️ **Security & Performance**
- **Encrypted Credentials** - Your JIRA credentials are never stored in plain text
- **Automatic Rate Limiting** - Respects JIRA API limits automatically
- **Intelligent Caching** - Reduces API calls with smart caching
- **Error Recovery** - Automatic retry with exponential backoff
- **Memory Management** - Efficient resource cleanup

### 🎯 **User Experience**
- **One-click Setup** - Easy configuration with connection testing
- **Real-time Updates** - Automatic refresh with configurable intervals
- **Keyboard Shortcuts** - Full keyboard navigation support
- **Dark/Light Theme** - Automatically adapts to Obsidian's theme
- **Accessibility** - Full ARIA support and screen reader compatibility

## 🚀 Quick Start

### 1. Installation

#### Option A: Manual Installation
1. Download the latest release from [Releases](../../releases)
2. Extract the plugin files to your Obsidian vault's `.obsidian/plugins/jira-dashboard/` directory
3. Enable the plugin in Obsidian Settings → Community plugins

#### Option B: Using the Installation Script
```bash
# Clone this repository
git clone https://github.com/caioniehues/jira-obsidian-plugin.git
cd jira-obsidian-plugin

# Build the plugin
npm install
npm run build

# Install to Obsidian (interactive script)
./install-to-obsidian.sh
```

### 2. Configuration

1. **Open the Dashboard:**
   - Click the dashboard icon in the left ribbon
   - Or use Command Palette: "Open Jira Dashboard"

2. **Configure JIRA Connection:**
   - Click "Configure JIRA"
   - Enter your JIRA credentials:
     - **Server URL**: `https://your-domain.atlassian.net`
     - **Email**: Your JIRA account email
     - **API Token**: Generate from [JIRA Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
     - **Master Password**: For encrypting your credentials

3. **Test Connection:**
   - Click "Test Connection" to verify your setup
   - Click "Save Configuration" to store credentials securely

### 3. Start Using

Once configured, you'll see:
- Your assigned JIRA issues
- Real-time updates
- Filtering and search capabilities
- Multiple grouping options

## 📖 Documentation

- **[Testing Guide](TESTING_GUIDE.md)** - Complete testing instructions
- **[Service Documentation](src/services/README.md)** - Detailed API documentation
- **[Installation Guide](install-to-obsidian.sh)** - Automated installation script

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Obsidian (for testing)

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/caioniehues/jira-obsidian-plugin.git
cd jira-obsidian-plugin

# Install dependencies
npm install

# Start development build with watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Project Structure

```
jira-obsidian-plugin/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components
│   │   ├── JiraDashboard.tsx
│   │   ├── JiraConfiguration.tsx
│   │   └── ...
│   ├── services/           # JIRA API service layer
│   │   ├── jiraApiService.ts
│   │   ├── httpClient.ts
│   │   ├── rateLimiter.ts
│   │   ├── AuthManager.ts
│   │   └── types.ts
│   ├── hooks/              # React hooks
│   ├── contexts/           # React contexts
│   ├── views/              # Obsidian view components
│   └── main.ts             # Plugin entry point
├── __tests__/              # Test files
├── docs/                   # Documentation
└── dist/                   # Build output
```

### Testing

The plugin includes comprehensive testing:

- **48 Test Cases** (36 unit + 12 integration tests)
- **92.3% Test Coverage** 
- **Jest** for unit testing
- **React Testing Library** for component testing
- **Mock Service Worker** for API mocking

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=jiraApiService
```

## 🔧 Configuration

### JIRA API Token Setup

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive name (e.g., "Obsidian JIRA Plugin")
4. Copy the generated token
5. Use this token in the plugin configuration

### JQL (JIRA Query Language) Examples

The plugin supports full JQL for advanced filtering:

```jql
# Your assigned issues
assignee = currentUser()

# Issues in a specific project
project = "PROJ"

# Issues with specific status
status = "In Progress"

# Issues assigned to you in the last week
assignee = currentUser() AND updated >= -7d

# High priority issues
priority = "High"

# Issues with specific labels
labels in ("bug", "urgent")

# Complex queries
project = "PROJ" AND assignee = currentUser() AND status != "Done" ORDER BY priority DESC
```

## 🚨 Troubleshooting

### Common Issues

1. **"JIRA Configuration Required" keeps showing:**
   - Verify your JIRA server URL format: `https://your-domain.atlassian.net`
   - Check that your API token is valid and not expired
   - Ensure your email address matches your JIRA account

2. **"Connection test failed":**
   - Verify your JIRA server is accessible
   - Check your API token permissions
   - Ensure your account has API access enabled

3. **"Failed to load tasks":**
   - Check your JQL query syntax
   - Verify you have permission to view the issues
   - Try a simpler query like `assignee = currentUser()`

4. **Plugin not loading:**
   - Check Obsidian console for errors (Help → Toggle Developer Tools)
   - Ensure plugin files are in the correct location
   - Try disabling and re-enabling the plugin

### Getting Help

1. **Check the Console:**
   - Open Developer Tools (Help → Toggle Developer Tools)
   - Look for error messages in the Console tab

2. **Test API Access:**
   ```bash
   curl -u your-email@example.com:your-api-token \
        -H "Accept: application/json" \
        https://your-domain.atlassian.net/rest/api/3/myself
   ```

3. **Report Issues:**
   - Create an issue on [GitHub Issues](../../issues)
   - Include console logs and error messages
   - Describe your JIRA setup and configuration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Run tests: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Obsidian** for the amazing note-taking platform
- **JIRA/Atlassian** for the comprehensive API
- **React** and **TypeScript** for the development experience
- **Tailwind CSS** for the beautiful UI components
- **Jest** and **React Testing Library** for testing

## 📊 Project Status

- ✅ **Core JIRA API Integration** - Complete
- ✅ **Authentication & Security** - Complete  
- ✅ **Dashboard UI** - Complete
- ✅ **Filtering & Search** - Complete
- ✅ **Rate Limiting** - Complete
- ✅ **Error Handling** - Complete
- ✅ **Testing** - Complete (92.3% coverage)
- ✅ **Documentation** - Complete

## 🔮 Roadmap

- [ ] **Issue Creation** - Create new JIRA issues from Obsidian
- [ ] **Issue Updates** - Edit issue details directly in the dashboard
- [ ] **Workflow Transitions** - Move issues through workflow states
- [ ] **Time Tracking** - Log work on JIRA issues
- [ ] **Notifications** - Real-time notifications for issue updates
- [ ] **Templates** - Pre-configured JQL templates
- [ ] **Export Features** - Export issues to various formats
- [ ] **Mobile Support** - Optimized mobile experience

---

**Made with ❤️ for the Obsidian and JIRA communities**

[![GitHub stars](https://img.shields.io/github/stars/caioniehues/jira-obsidian-plugin?style=social)](https://github.com/caioniehues/jira-obsidian-plugin/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/caioniehues/jira-obsidian-plugin?style=social)](https://github.com/caioniehues/jira-obsidian-plugin/network)
[![GitHub issues](https://img.shields.io/github/issues/caioniehues/jira-obsidian-plugin)](https://github.com/caioniehues/jira-obsidian-plugin/issues)
[![GitHub license](https://img.shields.io/github/license/caioniehues/jira-obsidian-plugin)](https://github.com/caioniehues/jira-obsidian-plugin/blob/main/LICENSE)
