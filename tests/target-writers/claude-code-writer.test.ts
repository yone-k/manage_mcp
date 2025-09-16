import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeCodeExporter } from '../../src/services/target-writers/claude-code-writer.js';
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

const existingConfig = {
  projects: {
    '/workspace/old': {
      mcpServers: {
        legacy: { command: 'node legacy.js' }
      }
    }
  },
  mcpServers: {
    old: { command: 'node old.js' }
  }
};

const registry: McpRegistry = {
  global: { command: 'npx', args: ['tool'] },
  'project[workspace].alpha': {
    command: 'docker',
    args: ['run'],
    project_path: '/workspace'
  },
  'project[workspace].beta': {
    command: 'docker',
    args: ['start'],
    project_path: '/workspace'
  }
};

describe('createClaudeCodeExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes global and project MCP entries into claude config', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));
    mockFs.writeFile.mockResolvedValue(undefined);

    const exporter = createClaudeCodeExporter();
    const result = await exporter.write(registry);

    expect(result.success).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/home/test/.claude.json',
      expect.stringContaining('"global"'),
      'utf8'
    );

    const written = JSON.parse(mockFs.writeFile.mock.calls[0][1]);
    expect(written.mcpServers).toEqual({
      global: { command: 'npx', args: ['tool'] }
    });
    expect(written.projects['/workspace'].mcpServers).toEqual({
      alpha: { command: 'docker', args: ['run'] },
      beta: { command: 'docker', args: ['start'] }
    });
    expect(written.projects['/workspace'].project_path).toBeUndefined();
  });
});
