#!/bin/bash

# JIRA Dashboard Plugin Installation Script
# This script helps you install the plugin in your Obsidian vault

echo "🚀 JIRA Dashboard Plugin Installation"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "main.js" ]; then
    echo "❌ Error: Please run this script from the jira-obsidian-plugin directory"
    echo "   Make sure you've built the plugin first with: npm run build"
    exit 1
fi

# Get Obsidian vault path
DEFAULT_VAULT="/home/caio/Documents/Obsidian/personal"
echo "📁 Obsidian vault path (press Enter for default: $DEFAULT_VAULT):"
echo "   (e.g., /home/username/Documents/MyVault)"
read -p "Vault path: " VAULT_PATH

# Use default if empty
if [ -z "$VAULT_PATH" ]; then
    VAULT_PATH="$DEFAULT_VAULT"
fi

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ Error: Vault path does not exist: $VAULT_PATH"
    exit 1
fi

# Check if .obsidian directory exists
OBSIDIAN_DIR="$VAULT_PATH/.obsidian"
if [ ! -d "$OBSIDIAN_DIR" ]; then
    echo "❌ Error: .obsidian directory not found in vault"
    echo "   Make sure this is a valid Obsidian vault"
    exit 1
fi

# Create plugins directory if it doesn't exist
PLUGINS_DIR="$OBSIDIAN_DIR/plugins"
if [ ! -d "$PLUGINS_DIR" ]; then
    echo "📁 Creating plugins directory..."
    mkdir -p "$PLUGINS_DIR"
fi

# Create plugin directory
PLUGIN_DIR="$PLUGINS_DIR/jira-dashboard"
if [ -d "$PLUGIN_DIR" ]; then
    echo "⚠️  Plugin directory already exists. Removing old version..."
    rm -rf "$PLUGIN_DIR"
fi

echo "📦 Installing plugin files..."
mkdir -p "$PLUGIN_DIR"

# Copy essential files
cp main.js "$PLUGIN_DIR/"
cp main.js.LICENSE.txt "$PLUGIN_DIR/" 2>/dev/null || true
cp manifest.json "$PLUGIN_DIR/"

# Copy styles if they exist
if [ -f "styles.css" ]; then
    cp styles.css "$PLUGIN_DIR/"
fi

echo "✅ Plugin installed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Open Obsidian"
echo "2. Go to Settings → Community plugins"
echo "3. Find 'Jira Dashboard' and enable it"
echo "4. Click the dashboard icon in the ribbon to open it"
echo "5. Configure your JIRA connection"
echo ""
echo "📖 For detailed instructions, see TESTING_GUIDE.md"
echo ""
echo "🔧 If you need to rebuild the plugin:"
echo "   npm run build"
echo "   Then run this script again"
