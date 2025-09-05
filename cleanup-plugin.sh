#!/bin/bash

# Cross-Platform Plugin Cleanup Script
# Removes symlinks and optionally cleans build artifacts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Plugin configuration
PLUGIN_ID="jira-dashboard"
PLUGIN_NAME="Jira Integration Plugin"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} ${PLUGIN_NAME} Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Try to read saved vault path
if [ -f ".vault-path" ]; then
    VAULT_PATH=$(cat .vault-path)
else
    # Try common locations
    if [ -d "$HOME/ObsidianVault/obsidian-second-brain" ]; then
        VAULT_PATH="$HOME/ObsidianVault/obsidian-second-brain"
    elif [ -d "$HOME/Documents/Obsidian/obsidian-second-brain" ]; then
        VAULT_PATH="$HOME/Documents/Obsidian/obsidian-second-brain"
    else
        echo -e "${YELLOW}⚠️  Could not auto-detect vault path${NC}"
        echo "Please enter the full path to your Obsidian vault:"
        read -r VAULT_PATH
        VAULT_PATH="${VAULT_PATH/#\~/$HOME}"
    fi
fi

PLUGIN_LINK="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

# Check if plugin is installed
if [ -L "$PLUGIN_LINK" ] || [ -d "$PLUGIN_LINK" ]; then
    # Save data.json if it exists
    if [ -f "$PLUGIN_LINK/data.json" ]; then
        echo -e "${BLUE}💾 Backing up plugin settings...${NC}"
        cp "$PLUGIN_LINK/data.json" "/tmp/jira-plugin-data.json"
        echo -e "${GREEN}✓${NC} Settings backed up to /tmp/jira-plugin-data.json"
    fi
    
    echo -e "${BLUE}🧹 Removing plugin from vault...${NC}"
    rm -rf "$PLUGIN_LINK"
    echo -e "${GREEN}✓${NC} Plugin removed from vault"
else
    echo -e "${YELLOW}ℹ️  Plugin not found in vault${NC}"
fi

# Ask about cleaning build artifacts
echo ""
read -p "Do you want to clean build artifacts (main.js, etc)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🗑️  Cleaning build artifacts...${NC}"
    
    [ -f "main.js" ] && rm main.js && echo "  Removed main.js"
    [ -f "main.js.map" ] && rm main.js.map && echo "  Removed main.js.map"
    [ -f "main.js.LICENSE.txt" ] && rm main.js.LICENSE.txt && echo "  Removed main.js.LICENSE.txt"
    [ -d "dist" ] && rm -rf dist && echo "  Removed dist/"
    
    echo -e "${GREEN}✓${NC} Build artifacts cleaned"
fi

# Ask about node_modules
echo ""
read -p "Do you want to remove node_modules? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🗑️  Removing node_modules...${NC}"
    rm -rf node_modules
    echo -e "${GREEN}✓${NC} node_modules removed"
fi

# Clean up saved vault path if requested
echo ""
read -p "Do you want to remove saved vault path? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f .vault-path
    echo -e "${GREEN}✓${NC} Saved vault path removed"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} ✅ Cleanup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "The plugin has been unlinked from your vault."
echo "To reinstall, run: ./setup-plugin.sh"
echo ""
if [ -f "/tmp/jira-plugin-data.json" ]; then
    echo -e "${BLUE}💡 Your settings are saved in /tmp/jira-plugin-data.json${NC}"
    echo "   They will be restored on next setup"
fi