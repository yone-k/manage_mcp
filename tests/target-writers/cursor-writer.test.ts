import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCursorExporter } from '../../src/services/target-writers/cursor-writer.js';
import type { McpRegistry } from '../../src/types/index.js';

const mockFs = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: mockFs.readFile,
      writeFile: mockFs.writeFile
    }
  };
});

const mockHomedir = vi.hoisted(() => vi.fn(() => '/home/test'));
vi.mock('os', () => ({ homedir: mockHomedir }));

const registry: McpRegistry = {
  global: { command: 'npx', args: ['tool'] },
  'project[workspace].alpha': {
    command: 'docker',
    args: ['run'],
    project_path: '/workspace'
  }
};

describe('createCursorReflector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes only global entries to cursor config', async () => {
    const existing = { mcpServers: { old: { command: 'node old.js' } } };
    mockFs.readFile.mockResolvedValue(JSON.stringify(existing));
    mockFs.writeFile.mockResolvedValue(undefined);

    const exporter = createCursorExporter();
    const result = await exporter.write(registry);

    expect(result.success).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/home/test/.cursor/mcp.json',
      expect.stringContaining('"global"'),
      'utf8'
    );

    const written = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
    expect(written.mcpServers).toEqual({
      global: { command: 'npx', args: ['tool'] }
    });
  });
});
