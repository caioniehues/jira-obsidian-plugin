// Jest setup file for testing environment
// This file is run before each test file

// Mock Obsidian API for testing
(global as any).obsidian = {
  Plugin: class MockPlugin {},
  ItemView: class MockItemView {},
  WorkspaceLeaf: class MockWorkspaceLeaf {},
  App: class MockApp {}
};
