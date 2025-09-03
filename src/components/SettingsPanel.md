# SettingsPanel Component

A comprehensive React settings component for the Jira Dashboard Obsidian plugin, built with React Hook Form and TypeScript.

## Features

### 🔐 Authentication Section
- Secure credential storage with encryption
- Real-time form validation
- Connection testing with user feedback
- Support for Jira Server and Cloud instances

### 🎨 Display Options
- Configurable tasks per page (10-500)
- Auto-refresh interval (1-60 minutes)  
- User avatar display toggle
- Compact mode for dense layouts
- Grouping options (project, priority, status, none)
- Sorting preferences (priority, due date, updated, created)

### 🔍 Filter Management
- Default JQL query configuration
- Saved JQL queries with custom names
- Add/remove/edit saved queries
- Set default query from saved list

### ⚡ Performance Settings
- Maximum task display limit (10-1000)
- Cache strategy selection (minimal, balanced, aggressive)
- Virtual scrolling toggle
- Lazy image loading toggle

## Usage

```tsx
import { SettingsPanel } from './components/SettingsPanel';
import { AuthManager } from './services/AuthManager';

function MySettingsView({ plugin }: { plugin: JiraPlugin }) {
  const authManager = new AuthManager(plugin);

  const handleSave = async (settings: JiraPluginSettings) => {
    await plugin.saveSettings(settings);
    // Refresh views, update components, etc.
  };

  const handleCancel = () => {
    // Close settings modal, navigate away, etc.
  };

  return (
    <SettingsPanel
      plugin={plugin}
      authManager={authManager}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
```

## Props Interface

```tsx
export interface SettingsPanelProps {
  plugin: JiraPlugin;                                    // Main plugin instance
  authManager: AuthManager;                              // Authentication manager
  onSave: (settings: JiraPluginSettings) => Promise<void>; // Save handler
  onCancel: () => void;                                  // Cancel handler
}
```

## Key Design Decisions

### Security
- API tokens are never stored in plain text
- Credentials encrypted using AES-GCM with device fingerprinting
- API tokens cleared from form after save
- Connection testing uses temporary credentials

### User Experience  
- Real-time form validation with helpful error messages
- Tab-based organization with keyboard navigation
- Obsidian-native styling and theme integration
- Loading states and progress indicators
- Accessible form controls with proper ARIA attributes

### Form Management
- React Hook Form for robust form handling
- TypeScript for compile-time validation
- Controlled components with proper state management
- Optimistic UI updates with error handling

## Validation Rules

### Authentication
- **Server URL**: Required, must use HTTPS
- **Email**: Required, valid email format  
- **API Token**: Required, minimum 10 characters

### Display
- **Tasks per page**: 10-500 range
- **Refresh interval**: 1-60 minutes
- **Grouping/Sorting**: Predefined enum values

### Performance
- **Max tasks**: 10-1000 range
- **Cache strategy**: enum validation
- **Boolean toggles**: Type-safe checkbox handling

## Integration Points

### AuthManager Integration
```tsx
// Store credentials securely
await authManager.storeCredentials(credentials);

// Load existing credentials  
const credentials = await authManager.getCredentials();

// Test connection
const result = await authManager.validateCredentials();
```

### Plugin Settings Integration
```tsx
// Settings are merged with existing plugin settings
const updatedSettings: JiraPluginSettings = {
  ...plugin.settings,
  // Updated fields from form
};

await onSave(updatedSettings);
```

## Accessibility Features

- **Keyboard Navigation**: Arrow keys for tab switching
- **Screen Reader Support**: Proper ARIA labels and roles
- **Focus Management**: Logical tab order and focus restoration
- **Error Announcements**: Error messages with `role="alert"`
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects `prefers-reduced-motion`

## Styling

The component uses CSS custom properties that automatically adapt to Obsidian's theme system:

- Follows Obsidian design tokens (`--size-4-*`, `--color-*`)
- Supports light/dark theme switching
- Responsive design for different screen sizes
- Print-friendly styles included

## Error Handling

- **Network Errors**: Graceful handling of connection failures
- **Validation Errors**: Real-time field validation with clear messages  
- **Save Errors**: User-friendly error display with dismiss option
- **Recovery**: Form state preserved during error conditions

## Testing

Comprehensive test suite covering:
- Component rendering and tab functionality
- Form validation and submission
- Authentication flow and error states
- Accessibility compliance
- Keyboard navigation
- JQL query management

Run tests with:
```bash
npm test SettingsPanel.test.tsx
```

## Performance Considerations

- **Lazy Evaluation**: Expensive computations deferred until needed
- **Debounced Validation**: Form validation optimized for responsiveness  
- **Memory Management**: Credentials cleared after use
- **Render Optimization**: React.memo and useCallback where beneficial

## Future Enhancements

- [ ] JQL syntax highlighting and validation
- [ ] Batch operations for multiple saved queries
- [ ] Import/export settings functionality  
- [ ] Advanced authentication options (OAuth, SSO)
- [ ] Custom theme color preferences
- [ ] Settings search and filtering