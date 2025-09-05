#!/bin/bash

# Cross-Platform Obsidian Plugin Setup Script
# Works on macOS and Linux
# This script builds the plugin and creates a symlink to your Obsidian vault

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Plugin configuration
PLUGIN_ID="jira-dashboard"  # Must match manifest.json id
PLUGIN_NAME="Jira Integration Plugin"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE} ${PLUGIN_NAME} Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Detect OS
OS_TYPE=$(uname -s)
case "$OS_TYPE" in
    Darwin*) 
        PLATFORM="macOS"
        DEFAULT_VAULT="$HOME/ObsidianVault/obsidian-second-brain"
        ;;
    Linux*)  
        PLATFORM="Linux"
        # Try common Linux paths
        if [ -d "$HOME/Documents/Obsidian/obsidian-second-brain" ]; then
            DEFAULT_VAULT="$HOME/Documents/Obsidian/obsidian-second-brain"
        else
            DEFAULT_VAULT="$HOME/ObsidianVault/obsidian-second-brain"
        fi
        ;;
    *)       
        PLATFORM="Unknown"
        DEFAULT_VAULT="$HOME/ObsidianVault/obsidian-second-brain"
        ;;
esac

echo -e "${GREEN}✓${NC} Detected platform: ${PLATFORM}"

# Allow override via environment variable
VAULT_PATH="${OBSIDIAN_VAULT:-$DEFAULT_VAULT}"

# Check if vault exists, if not ask user
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${YELLOW}⚠️  Vault not found at: $VAULT_PATH${NC}"
    echo ""
    echo "Please enter the full path to your Obsidian vault:"
    echo "(e.g., /Users/username/ObsidianVault/my-vault)"
    read -r VAULT_PATH
    
    # Expand tilde if present
    VAULT_PATH="${VAULT_PATH/#\~/$HOME}"
    
    if [ ! -d "$VAULT_PATH" ]; then
        echo -e "${RED}❌ Error: Vault not found at $VAULT_PATH${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Found vault at: $VAULT_PATH"

# Check if we're in the plugin directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in a plugin directory (no package.json found)${NC}"
    echo "Please run this script from the plugin's root directory"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error: Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# Build the plugin
echo ""
echo -e "${BLUE}🔨 Building plugin...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Build failed${NC}"
    exit 1
fi

# Check if main.js was created
if [ ! -f "main.js" ]; then
    echo -e "${RED}❌ Error: Build did not create main.js${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build successful"

# Create plugins directory if it doesn't exist
PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins"
if [ ! -d "$PLUGINS_DIR" ]; then
    echo ""
    echo -e "${BLUE}📁 Creating plugins directory...${NC}"
    mkdir -p "$PLUGINS_DIR"
fi

# Remove existing installation if present
PLUGIN_LINK="$PLUGINS_DIR/$PLUGIN_ID"
if [ -L "$PLUGIN_LINK" ] || [ -d "$PLUGIN_LINK" ]; then
    echo ""
    echo -e "${YELLOW}🧹 Removing existing installation...${NC}"
    rm -rf "$PLUGIN_LINK"
fi

# Create symlink
echo ""
echo -e "${BLUE}🔗 Creating symlink...${NC}"
ln -s "$PWD" "$PLUGIN_LINK"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Symlink created successfully"
else
    echo -e "${RED}❌ Error: Failed to create symlink${NC}"
    exit 1
fi

# Restore data.json if we have a backup
if [ -f "/tmp/jira-plugin-data.json" ]; then
    echo ""
    echo -e "${BLUE}📋 Restoring plugin settings...${NC}"
    mkdir -p "$PLUGIN_LINK"
    cp "/tmp/jira-plugin-data.json" "$PLUGIN_LINK/data.json"
    echo -e "${GREEN}✓${NC} Settings restored"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} ✅ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Reload Obsidian (Cmd/Ctrl + R) or restart the app"
echo "2. Go to Settings → Community plugins"
echo "3. Enable '${PLUGIN_NAME}'"
echo "4. Configure your Jira credentials in plugin settings"
echo ""
echo -e "${BLUE}💡 For development:${NC}"
echo "   Run 'npm run dev' to start watch mode"
echo "   Changes will be reflected after reloading Obsidian"
echo ""

# Save vault path for future use
echo "$VAULT_PATH" > .vault-path

echo -e "${GREEN}✨ Happy coding!${NC}"