import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMcpConfig, resolveProfile, promptOverwrite, mergeEntries } from '../src/services/extract-service.js';
import type { ExtractOptions, McpRegistry, ConfigPaths, RegistryLoad } from '../src/types/index.js';

const mockConfigService = vi.hoisted(() => ({
  resolveConfigPaths: vi.fn(),
  readRegistry: vi.fn(),
  writeRegistry: vi.fn(),
  ensureBackup: vi.fn()
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

vi.mock('../src/services/config-service.js', () => mockConfigService);
vi.mock('../src/infra/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}));

const mockClaudeCodeProfile = vi.hoisted(() => ({
  readSource: vi.fn(),
  mapToRegistry: vi.fn()
}));

vi.mock('../src/services/source-readers/claude-code.js', () => ({
  createClaudeCodeProfile: vi.fn(() => mockClaudeCodeProfile)
}));
vi.mock('../src/services/source-readers/claude-desktop.js', () => ({
  createClaudeDesktopProfile: vi.fn(() => mockClaudeCodeProfile)
}));
vi.mock('../src/services/source-readers/cursor.js', () => ({
  createCursorProfile: vi.fn(() => mockClaudeCodeProfile)
}));
vi.mock('../src/services/source-readers/codex.js', () => ({
  createCodexProfile: vi.fn(() => mockClaudeCodeProfile)
}));

describe('extract-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveProfile', () => {
    it('should return ClaudeCode profile for "ClaudeCode" tool', () => {
      const result = resolveProfile('ClaudeCode');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(typeof result.data.readSource).toBe('function');
        expect(typeof result.data.mapToRegistry).toBe('function');
      }
    });

    it('should return error for unsupported tool', () => {
      const result = resolveProfile('UnsupportedTool');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('ValidationFailed');
        expect(result.error.message).toContain('Unsupported tool');
      }
    });
  });

  describe('promptOverwrite', () => {
    it('should return all true when force is enabled', async () => {
      const mockPrompt = vi.fn();
      const names = ['entry1', 'entry2'];

      const result = await promptOverwrite(names, true, mockPrompt);

      expect(result).toEqual({ entry1: true, entry2: true });
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should use prompt function when force is disabled', async () => {
      const mockPrompt = vi.fn().mockResolvedValue({ entry1: true, entry2: false });
      const names = ['entry1', 'entry2'];

      const result = await promptOverwrite(names, false, mockPrompt);

      expect(result).toEqual({ entry1: true, entry2: false });
      expect(mockPrompt).toHaveBeenCalledWith(names);
    });
  });

  describe('mergeEntries', () => {
    it('should merge entries with no conflicts', () => {
      const base: McpRegistry = { 'existing': { command: 'test' } };
      const additions: McpRegistry = { 'new': { command: 'new-test' } };
      const decisions = {};

      const result = mergeEntries(base, additions, decisions);

      expect(result.conflicts).toEqual([]);
      expect(result.merged).toEqual({
        'existing': { command: 'test' },
        'new': { command: 'new-test' }
      });
    });

    it('should detect conflicts and apply decisions', () => {
      const base: McpRegistry = { 'conflict': { command: 'old' } };
      const additions: McpRegistry = { 'conflict': { command: 'new' } };
      const decisions = { 'conflict': true };

      const result = mergeEntries(base, additions, decisions);

      expect(result.conflicts).toEqual(['conflict']);
      expect(result.merged).toEqual({ 'conflict': { command: 'new' } });
    });
  });

  describe('extractMcpConfig', () => {
    it('should extract and merge MCP config successfully', async () => {
      const tool = 'ClaudeCode';
      const options: ExtractOptions = { force: false, env: {} };
      const mockPaths: ConfigPaths = {
        configDir: '/test',
        configFile: '/test/mcp.json',
        backupFile: '/test/mcp.json.bak'
      };
      const mockRegistry: RegistryLoad = {
        registry: {},
        source: 'initialized'
      };

      mockConfigService.resolveConfigPaths.mockReturnValue(mockPaths);
      mockConfigService.readRegistry.mockResolvedValue({ success: true, data: mockRegistry });
      mockConfigService.ensureBackup.mockResolvedValue({ success: true, data: undefined });
      mockConfigService.writeRegistry.mockResolvedValue({ success: true, data: undefined });

      mockClaudeCodeProfile.readSource.mockResolvedValue({
        success: true,
        data: {
          entries: {},
          promptRequired: []
        }
      });

      const result = await extractMcpConfig(tool, options);

      expect(result.tool).toBe(tool);
      expect(result.addedCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle source missing case', async () => {
      const tool = 'ClaudeCode';
      const options: ExtractOptions = { force: false, env: {} };

      mockClaudeCodeProfile.readSource.mockResolvedValue({
        success: false,
        error: {
          type: 'SourceMissing',
          message: 'File not found'
        }
      });

      const result = await extractMcpConfig(tool, options);

      expect(result.tool).toBe(tool);
      expect(result.addedCount).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No MCP entries found'));
    });
  });
});
