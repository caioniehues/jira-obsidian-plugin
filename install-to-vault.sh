#!/bin/bash

# Installation script for Jira Dashboard Plugin
# Usage: ./install-to-vault.sh [vault-path]

SECOND_BRAIN="/home/caio/Documents/Obsidian/obsidian-second-brain"
PERSONAL="/home/caio/Documents/Obsidian/personal"

# Default to Second Brain vault
VAULT_PATH="${1:-$SECOND_BRAIN}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Jira Dashboard Plugin Installer${NC}"
echo "=================================="

# Check if vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo -e "${RED}❌ Vault not found at: $VAULT_PATH${NC}"
    exit 1
fi

# Create plugin directory if it doesn't exist
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/jira-obsidian-plugin"
mkdir -p "$PLUGIN_DIR"

# Build the plugin
echo -e "${BLUE}📦 Building plugin...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Copy files
echo -e "${BLUE}📋 Installing to: $VAULT_PATH${NC}"
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"

# Verify installation
if [ -f "$PLUGIN_DIR/main.js" ] && [ -f "$PLUGIN_DIR/manifest.json" ]; then
    echo -e "${GREEN}✅ Plugin installed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open/reload Obsidian"
    echo "2. Go to Settings → Community Plugins"
    echo "3. Enable 'Jira Dashboard'"
    echo "4. Click the Jira icon in the ribbon to configure"
    echo ""
    echo "Your credentials are stored in .env file"
else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi