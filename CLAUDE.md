# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Location & Setup

This plugin is part of the Obsidian vault ecosystem and follows standardized development practices:

- **Standard Location**: `~/ObsidianPlugins/jira-integration/`
- **Repository**: https://github.com/caioniehues/jira-obsidian-plugin
- **Plugin ID**: `jira-dashboard` (must match manifest.json)
- **Vault Registry**: See vault's `📚 Documentation/development/PLUGIN_REGISTRY.md`

### Cross-Platform Setup

```bash
# Quick setup (auto-detects OS and vault location)
./setup-plugin.sh

# Development mode
npm run dev

# Clean up when switching branches/machines
./cleanup-plugin.sh
```

The setup scripts work on both macOS and Linux, automatically detecting:
- Operating system differences
- Common vault locations
- Existing installations

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Code quality checks
npm run lint           # ESLint for TypeScript/React
npm run typecheck      # TypeScript type checking

# Testing
npm test               # Run test suite
npm run test:coverage  # Generate coverage report
```

## Project Architecture

This is an Obsidian plugin that integrates Jira task management with a beautiful React-based dashboard.

### Core Structure

- **Entry Point**: `src/main.ts` - Obsidian plugin class that registers views and commands
- **Output**: `main.js` - Webpack bundles everything into a single CommonJS module for Obsidian
- **Target Bundle Size**: <5MB for optimal performance

### Key Components

#### Plugin Architecture (`src/main.ts`)
- Extends Obsidian's `Plugin` class
- Registers custom view for Jira dashboard
- Manages plugin lifecycle (onload/onunload)
- Provides ribbon icon and command palette integration

#### React Integration (`src/views/JiraView.tsx`)
- Extends `ItemView` for Obsidian compatibility
- Creates React root in `onOpen()` lifecycle
- Properly cleans up React in `onClose()`
- Integrates with Obsidian's theme system via `ObsidianThemeProvider`

#### Jira API Service (`src/services/JiraService.ts`)
- **Rate Limiting**: 100 requests/minute with burst handling
- **Caching**: 5-minute TTL with LRU eviction
- **Retry Logic**: Exponential backoff (3 retries max)
- **Priority Queue**: CRITICAL > HIGH > MEDIUM > LOW
- Full TypeScript support with branded types (`IssueKey`, `UserId`)

#### Authentication (`src/services/AuthManager.ts`)
- **Encryption**: AES-256-GCM for API tokens
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Storage**: Encrypted IndexedDB with device fingerprinting
- **Memory Safety**: Automatic clearing of sensitive data

## Implementation Guidelines

### Creating New Views

```typescript
import { ItemView } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';

export class CustomView extends ItemView {
  private root: Root | null = null;

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    
    this.root = createRoot(container);
    this.root.render(<YourComponent />);
  }

  async onClose() {
    this.root?.unmount();
  }

  getViewType() { return 'your-view-type'; }
  getDisplayText() { return 'Your View'; }
}
```

### Using JiraService

```typescript
// High-priority user request
const tasks = await jiraService.fetchTasks(
  'assignee = currentUser() AND status != Done',
  { priority: 'HIGH', useCache: true }
);

// Bulk operations with batching
await jiraService.bulkUpdateTasks(updates, {
  batchSize: 10,
  priority: 'MEDIUM'
});

// Monitor service health
const stats = jiraService.getStats();
if (stats.cache.hitRate < 50) {
  console.warn('Low cache performance');
}
```

### Security Best Practices

1. Never store plain text credentials
2. Use AuthManager for all authentication
3. Clear sensitive data from memory after use
4. Validate all Jira API responses
5. Implement proper error boundaries in React

## Build Configuration

### Webpack Optimization
- Tree shaking enabled for unused code removal
- Code splitting for lazy-loaded components
- Externals configured for Obsidian modules
- Source maps disabled in production

### TypeScript Configuration
- Strict mode enabled for type safety
- Path aliases: `@/*` maps to `src/*`
- Target: ES2022 for modern JavaScript features
- JSX: React for component syntax

## Performance Considerations

### Memory Management
- Virtual scrolling for lists >50 items
- React.memo for expensive components
- Cleanup intervals for caches
- Maximum cache entries: 1000

### Network Optimization
- Batch API requests when possible
- Use cache-first strategy for read operations
- Implement request deduplication
- Priority queue for user-initiated actions

## Testing Strategy

### Unit Tests
- Services: 90% coverage target
- Components: 80% coverage target
- Use Jest with React Testing Library

### Integration Tests
- API interaction mocking
- Obsidian plugin API mocking
- End-to-end user flows

## Common Issues and Solutions

### Build Errors

**Issue**: "Module not found: Error: Can't resolve './src'"
**Solution**: Ensure `src/main.ts` exists as the entry point

**Issue**: Bundle size exceeds 5MB
**Solution**: Check for accidentally bundled dependencies, enable production mode

### Runtime Errors

**Issue**: React components not rendering
**Solution**: Verify React root is properly created in ItemView

**Issue**: Jira API rate limiting
**Solution**: Increase cache TTL, reduce request frequency

## Dependencies

### Core
- `obsidian`: Plugin API (marked as external)
- `react` & `react-dom`: UI framework
- `typescript`: Type safety

### UI Components
- `@radix-ui/*`: Accessible component primitives
- `tailwindcss`: Utility-first CSS
- `framer-motion`: Animations

### Data Management
- `@tanstack/react-query`: Server state management
- `lru-cache`: Efficient caching
- `react-hook-form`: Form validation

### Development
- `webpack` & `ts-loader`: Build tooling
- `eslint` & `@typescript-eslint/*`: Linting
- `jest`: Testing framework

## File Structure

```
jira-obsidian-plugin/
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── types.ts             # TypeScript definitions
│   ├── views/
│   │   └── JiraView.tsx     # Dashboard view
│   ├── services/
│   │   ├── JiraService.ts   # API integration
│   │   └── AuthManager.ts   # Authentication
│   ├── components/
│   │   ├── JiraDashboard.tsx
│   │   └── ObsidianThemeProvider.tsx
│   └── utils/               # Helper functions
├── manifest.json            # Obsidian plugin metadata
├── webpack.config.js        # Build configuration
└── main.js                  # Built output (git-ignored)
```

## Next Steps for Development

1. **Implement Settings Panel** - User configuration for Jira connection
2. **Complete Cache Manager** - Three-layer caching system
3. **Add UI Components** - shadcn/ui integration
4. **Task Dashboard** - Main interface implementation
5. **AI Features** - TensorFlow.js for smart suggestions