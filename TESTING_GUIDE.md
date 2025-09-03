# JIRA Dashboard Plugin Testing Guide

## 🚀 How to Test the Plugin in Obsidian

### 1. **Install the Plugin in Obsidian**

1. **Copy the built plugin files:**
   ```bash
   # The plugin is already built and ready
   # Copy the entire jira-obsidian-plugin folder to your Obsidian vault's .obsidian/plugins/ directory
   ```

2. **Enable the plugin in Obsidian:**
   - Open Obsidian
   - Go to Settings → Community plugins
   - Find "Jira Dashboard" in the list
   - Enable it

### 2. **Configure JIRA Connection**

1. **Open the JIRA Dashboard:**
   - Click the dashboard icon in the left ribbon
   - Or use the command palette: "Open Jira Dashboard"

2. **Configure your JIRA credentials:**
   - You'll see a "JIRA Configuration Required" screen
   - Click "Configure JIRA" button
   - Fill in the required information:
     - **JIRA Server URL**: `https://your-domain.atlassian.net`
     - **Email Address**: Your JIRA account email
     - **API Token**: Generate from JIRA account settings
     - **Master Password**: Password to encrypt your credentials

3. **Test the connection:**
   - Click "Test Connection" to verify your credentials
   - Click "Save Configuration" to store them securely

### 3. **Using the Dashboard**

Once configured, you'll see:

- **Welcome message** with your JIRA username
- **Task list** showing your assigned issues
- **Filter options** to customize the view
- **Search functionality** to find specific tasks
- **Grouping options** (by status, priority, or assignee)

### 4. **Features to Test**

#### ✅ **Basic Functionality**
- [ ] Plugin loads without errors
- [ ] Configuration screen appears when not configured
- [ ] Can save JIRA credentials securely
- [ ] Connection test works
- [ ] Dashboard shows your JIRA issues

#### ✅ **JIRA Integration**
- [ ] Fetches real issues from your JIRA instance
- [ ] Shows correct issue details (summary, status, priority, assignee)
- [ ] Displays issue types and labels
- [ ] Shows user avatars and names

#### ✅ **Dashboard Features**
- [ ] Filter bar works (search by text)
- [ ] Grouping by status works
- [ ] Grouping by priority works
- [ ] Grouping by assignee works
- [ ] Refresh button updates the data
- [ ] Settings button opens configuration

#### ✅ **Error Handling**
- [ ] Shows appropriate error messages for invalid credentials
- [ ] Handles network errors gracefully
- [ ] Provides retry options
- [ ] Shows loading states

### 5. **Troubleshooting**

#### **Common Issues:**

1. **"JIRA Configuration Required" keeps showing:**
   - Check that your credentials are correct
   - Verify your JIRA server URL is accessible
   - Make sure your API token is valid

2. **"Connection test failed":**
   - Verify your JIRA server URL format: `https://your-domain.atlassian.net`
   - Check that your email and API token are correct
   - Ensure your JIRA account has API access

3. **"Failed to load tasks":**
   - Check your JQL query in the filter
   - Verify you have permission to view the issues
   - Try a simpler query like `assignee = currentUser()`

4. **Plugin not loading:**
   - Check the Obsidian console for errors (Help → Toggle Developer Tools)
   - Ensure the plugin files are in the correct location
   - Try disabling and re-enabling the plugin

#### **Getting Help:**

1. **Check the console:**
   - Open Developer Tools (Help → Toggle Developer Tools)
   - Look for any error messages in the Console tab

2. **Test with a simple JQL query:**
   - Try: `assignee = currentUser()`
   - Or: `project = "YOUR_PROJECT_KEY"`

3. **Verify JIRA API access:**
   - Test your credentials with a simple curl command:
   ```bash
   curl -u your-email@example.com:your-api-token \
        -H "Accept: application/json" \
        https://your-domain.atlassian.net/rest/api/3/myself
   ```

### 6. **Expected Behavior**

#### **First Time Setup:**
1. Plugin shows configuration screen
2. User enters JIRA credentials
3. Connection test succeeds
4. Credentials are saved securely
5. Dashboard loads with user's issues

#### **Subsequent Uses:**
1. Plugin automatically connects using stored credentials
2. Dashboard loads immediately
3. User can view, filter, and group their issues
4. Settings can be accessed to reconfigure if needed

#### **Performance:**
- Initial load: 2-5 seconds (depending on issue count)
- Refresh: 1-3 seconds
- Rate limiting: 100 requests/minute (handled automatically)
- Caching: Issues cached for 2 minutes

### 7. **Test Data**

The plugin will show real data from your JIRA instance:
- Issues assigned to you
- Issues in projects you have access to
- Real issue details, statuses, and priorities
- Actual user information and avatars

### 8. **Security Notes**

- ✅ Credentials are encrypted with AES-256-GCM
- ✅ API tokens are never stored in plain text
- ✅ Master password is used only for encryption/decryption
- ✅ All API calls use HTTPS
- ✅ Rate limiting prevents API abuse

---

## 🎉 Success Criteria

The plugin is working correctly if you can:

1. **Configure JIRA connection** without errors
2. **See your real JIRA issues** in the dashboard
3. **Filter and search** through your issues
4. **Group issues** by different criteria
5. **Refresh data** and see updates
6. **Access settings** to reconfigure if needed

If all these work, congratulations! Your JIRA Dashboard plugin is successfully integrated and ready for daily use! 🚀
