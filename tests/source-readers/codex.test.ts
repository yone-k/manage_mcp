import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCodexProfile } from '../../src/services/source-readers/codex.js';

const mockFs = vi.hoisted(() => ({
  readFile: vi.fn()
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: mockFs
  };
});

const mockHomedir = vi.hoisted(() => vi.fn(() => '/home/test'));
vi.mock('os', () => ({ homedir: mockHomedir }));

const mockToml = vi.hoisted(() => ({
  parse: vi.fn()
}));

vi.mock('@iarna/toml', () => mockToml);

describe('codex profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapToRegistry', () => {
    it('should import MCP entries from mcp_servers sections', () => {
      const profile = createCodexProfile();
      const sourceData = {
        mcp_servers: {
          context7: {
            command: 'npx',
            args: ['@context7/mcp']
          },
          gitlab: {
            command: 'docker',
            args: ['run', 'gitlab-mcp']
          }
        }
      };

      const result = profile.mapToRegistry(sourceData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          'context7': {
            command: 'npx',
            args: ['@context7/mcp']
          },
          'gitlab': {
            command: 'docker',
            args: ['run', 'gitlab-mcp']
          }
        });
      }
    });

    it('should return empty registry when no mcp_servers section', () => {
      const profile = createCodexProfile();
      const sourceData = {
        other_section: {
          value: 'test'
        }
      };

      const result = profile.mapToRegistry(sourceData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });

  describe('readSource', () => {
    it('should read and parse ~/.codex/config.toml successfully', async () => {
      const profile = createCodexProfile();
      const tomlContent = `
[mcp_servers.context7]
command = "npx"
args = ["@context7/mcp"]
`;
      const parsedData = {
        mcp_servers: {
          context7: {
            command: 'npx',
            args: ['@context7/mcp']
          }
        }
      };

      mockFs.readFile.mockResolvedValue(tomlContent);
      mockToml.parse.mockReturnValue(parsedData);

      const result = await profile.readSource();

      expect(result.success).toBe(true);
      expect(mockFs.readFile).toHaveBeenCalledWith('/home/test/.codex/config.toml', 'utf8');
      expect(mockToml.parse).toHaveBeenCalledWith(tomlContent);
    });

    it('should return SourceMissing error when file does not exist', async () => {
      const profile = createCodexProfile();
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await profile.readSource();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SourceMissing');
      }
    });

    it('should return ParseFailed error for invalid TOML', async () => {
      const profile = createCodexProfile();
      mockFs.readFile.mockResolvedValue('invalid toml [[[');
      mockToml.parse.mockImplementation(() => {
        throw new Error('Invalid TOML syntax');
      });

      const result = await profile.readSource();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('ParseFailed');
      }
    });
  });
});