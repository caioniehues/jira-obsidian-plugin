#!/bin/bash

# Clear Obsidian Cache Script for Arch Linux
echo "🧹 Clearing Obsidian Cache..."
echo "=============================="

# # Check if Obsidian is running
# if pgrep -f "obsidian" > /dev/null; then
#     echo "⚠️  Obsidian is running. Please close it first and run this script again."
#     exit 1
# fi

echo "📁 Clearing IndexedDB cache..."
rm -rf /home/caio/.config/obsidian/IndexedDB/*

echo "📁 Clearing GPU cache..."
rm -rf /home/caio/.config/obsidian/GPUCache

echo "📁 Clearing Code cache..."
rm -rf /home/caio/.config/obsidian/Code\ Cache

echo "📁 Clearing Cached data..."
rm -rf /home/caio/.config/obsidian/CachedData

echo "📁 Clearing logs..."
rm -rf /home/caio/.config/obsidian/logs

echo "✅ Obsidian cache cleared successfully!"
echo ""
echo "🚀 You can now restart Obsidian with a clean cache."
