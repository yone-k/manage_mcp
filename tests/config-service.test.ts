import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { resolveConfigPaths, readRegistry, writeRegistry, ensureBackup } from '../src/services/config-service.js';
import type { McpRegistry } from '../src/types/index.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      access: vi.fn(),
      copyFile: vi.fn()
    }
  };
});

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test')
}));

const mockFs = fs as any;

describe('resolveConfigPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default paths when MCP_CONFIG_DIR is not set', () => {
    const env = {};
    const result = resolveConfigPaths(env);

    expect(result).toEqual({
      configDir: '/home/test/.manage_mcp',
      configFile: '/home/test/.manage_mcp/mcp.json',
      backupFile: '/home/test/.manage_mcp/mcp.json.bak'
    });
  });

  it('should return custom paths when MCP_CONFIG_DIR is set', () => {
    const env = { MCP_CONFIG_DIR: '/custom/path' };
    const result = resolveConfigPaths(env);

    expect(result).toEqual({
      configDir: '/custom/path',
      configFile: '/custom/path/mcp.json',
      backupFile: '/custom/path/mcp.json.bak'
    });
  });
});

describe('readRegistry', () => {
  const paths = {
    configDir: '/test',
    configFile: '/test/mcp.json',
    backupFile: '/test/mcp.json.bak'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty registry when file does not exist', async () => {
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

    const result = await readRegistry(paths);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it('should return parsed registry when file exists', async () => {
    const registryData = { 'test': { command: 'docker' } };
    const configData = { mcpServers: registryData };
    mockFs.readFile.mockResolvedValue(JSON.stringify(configData));

    const result = await readRegistry(paths);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(registryData);
    }
  });

  it('should handle legacy format (no mcpServers key)', async () => {
    const registryData = { 'test': { command: 'docker' } };
    mockFs.readFile.mockResolvedValue(JSON.stringify(registryData));

    const result = await readRegistry(paths);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it('should return error for invalid JSON', async () => {
    mockFs.readFile.mockResolvedValue('invalid json');

    const result = await readRegistry(paths);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('InvalidJSON');
    }
  });

  it('should return error for permission denied', async () => {
    mockFs.readFile.mockRejectedValue({ code: 'EACCES' });

    const result = await readRegistry(paths);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('PermissionDenied');
    }
  });
});

describe('writeRegistry', () => {
  const paths = {
    configDir: '/test',
    configFile: '/test/mcp.json',
    backupFile: '/test/mcp.json.bak'
  };

  const registry: McpRegistry = {
    'test': { command: 'docker' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create directory and write file successfully', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result = await writeRegistry(paths, registry);

    expect(result.success).toBe(true);
    expect(mockFs.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/test/mcp.json',
      JSON.stringify({ mcpServers: registry }, null, 2),
      'utf8'
    );
  });

  it('should return error when write fails', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

    const result = await writeRegistry(paths, registry);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Unknown');
      expect(result.error.message).toContain('Write failed');
    }
  });
});

describe('ensureBackup', () => {
  const paths = {
    configDir: '/test',
    configFile: '/test/mcp.json',
    backupFile: '/test/mcp.json.bak'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create backup when source file exists', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.copyFile.mockResolvedValue(undefined);

    const result = await ensureBackup(paths);

    expect(result.success).toBe(true);
    expect(mockFs.copyFile).toHaveBeenCalledWith('/test/mcp.json', '/test/mcp.json.bak');
  });

  it('should succeed when source file does not exist', async () => {
    mockFs.access.mockRejectedValue({ code: 'ENOENT' });

    const result = await ensureBackup(paths);

    expect(result.success).toBe(true);
    expect(mockFs.copyFile).not.toHaveBeenCalled();
  });

  it('should return error when backup fails', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.copyFile.mockRejectedValue(new Error('Backup failed'));

    const result = await ensureBackup(paths);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Unknown');
    }
  });

  it('should return error for permission denied during access check', async () => {
    mockFs.access.mockRejectedValue({ code: 'EACCES' });

    const result = await ensureBackup(paths);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('Unknown');
    }
  });
});