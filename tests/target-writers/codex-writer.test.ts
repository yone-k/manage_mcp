import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCodexExporter } from '../../src/services/target-writers/codex-writer.js';
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

const mockToml = vi.hoisted(() => ({
  stringify: vi.fn((data: unknown) => `stringified:${JSON.stringify(data)}`),
  parse: vi.fn()
}));

vi.mock('@iarna/toml', () => mockToml);

const registry: McpRegistry = {
  global: { command: 'npx', args: ['tool'] },
  'project[workspace].alpha': {
    command: 'docker',
    args: ['run'],
    project_path: '/workspace'
  }
};

describe('createCodexReflector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes only global entries into codex TOML', async () => {
    mockFs.readFile.mockResolvedValue('existing');
    mockToml.parse.mockReturnValue({ tools: { web_search: true } });
    mockFs.writeFile.mockResolvedValue(undefined);

    const exporter = createCodexExporter();
    const result = await exporter.write(registry);

    expect(result.success).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/home/test/.codex/config.toml',
      expect.stringContaining('stringified'),
      'utf8'
    );

    const writtenObj = mockToml.stringify.mock.calls[0][0];
    expect(writtenObj.mcp_servers).toEqual({
      global: {
        command: 'npx',
        args: ['tool']
      }
    });
  });
});
