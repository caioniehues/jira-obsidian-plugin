#!/bin/bash

# JIRA Dashboard Plugin Development Workflow
# This script rebuilds and reinstalls the plugin for testing

echo "🔧 JIRA Dashboard Plugin Development Workflow"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the jira-obsidian-plugin directory"
    exit 1
fi

echo "📦 Building plugin..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix the errors and try again."
    exit 1
fi

echo "✅ Build successful!"
echo ""

echo "🚀 Installing to Obsidian..."
./install-to-obsidian.sh

echo ""
echo "🎉 Development workflow complete!"
echo "   The plugin has been rebuilt and installed to your Obsidian vault."
echo "   You can now test it in Obsidian."
