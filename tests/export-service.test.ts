import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportMcpConfig, resolveExporter } from '../src/services/export-service.js';
import type { ExportOptions, McpRegistry, ConfigPaths, RegistryLoad } from '../src/types/index.js';

const mockConfigService = vi.hoisted(() => ({
  resolveConfigPaths: vi.fn(),
  readRegistry: vi.fn()
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

vi.mock('../src/services/config-service.js', () => mockConfigService);
vi.mock('../src/infra/logger.js', () => ({
  createLogger: vi.fn(() => mockLogger)
}));

const mockExporter = vi.hoisted(() => ({
  write: vi.fn()
}));

vi.mock('../src/services/target-writers/claude-code-writer.js', () => ({
  createClaudeCodeExporter: vi.fn(() => mockExporter)
}));
vi.mock('../src/services/target-writers/claude-desktop-writer.js', () => ({
  createClaudeDesktopExporter: vi.fn(() => mockExporter)
}));
vi.mock('../src/services/target-writers/cursor-writer.js', () => ({
  createCursorExporter: vi.fn(() => mockExporter)
}));
vi.mock('../src/services/target-writers/codex-writer.js', () => ({
  createCodexExporter: vi.fn(() => mockExporter)
}));

describe('export-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveExporter', () => {
    it('returns exporter for supported tool', () => {
      const result = resolveExporter('ClaudeCode');
      expect(result.success).toBe(true);
    });

    it('returns error for unsupported tool', () => {
      const result = resolveExporter('Unknown');
      expect(result.success).toBe(false);
    });
  });

  describe('exportMcpConfig', () => {
    const options: ExportOptions = { env: {}, tools: ['ClaudeCode', 'Cursor'] };
    const mockPaths: ConfigPaths = {
      configDir: '/config',
      configFile: '/config/mcp.json',
      backupFile: '/config/mcp.json.bak'
    };
    const registry: McpRegistry = {
      global: { command: 'npx', args: ['tool'] }
    };

    it('writes registry to requested exporters', async () => {
      const registryLoad: RegistryLoad = { registry, source: 'existing' };
      mockConfigService.resolveConfigPaths.mockReturnValue(mockPaths);
      mockConfigService.readRegistry.mockResolvedValue({ success: true, data: registryLoad });
      mockExporter.write.mockResolvedValue({ success: true, data: undefined });

      const summary = await exportMcpConfig(options.tools, options);

      expect(mockExporter.write).toHaveBeenCalledTimes(options.tools.length);
      expect(summary.updatedTools).toEqual(options.tools);
    });

    it('throws when registry cannot be read', async () => {
      mockConfigService.resolveConfigPaths.mockReturnValue(mockPaths);
      mockConfigService.readRegistry.mockResolvedValue({
        success: false,
        error: {
          type: 'InvalidJSON',
          message: 'bad json'
        }
      });

      await expect(exportMcpConfig(options.tools, options)).rejects.toThrow('bad json');
    });

    it('throws when exporter fails', async () => {
      const registryLoad: RegistryLoad = { registry, source: 'existing' };
      mockConfigService.resolveConfigPaths.mockReturnValue(mockPaths);
      mockConfigService.readRegistry.mockResolvedValue({ success: true, data: registryLoad });
      mockExporter.write.mockResolvedValueOnce({
        success: false,
        error: {
          type: 'IOError',
          message: 'failed to write'
        }
      });

      await expect(exportMcpConfig(['ClaudeCode'], options)).rejects.toThrow('failed to write');
    });
  });
});
