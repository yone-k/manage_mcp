import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeDesktopProfile } from '../../src/services/source-readers/claude-desktop.js';

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

describe('claude-desktop profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapToRegistry', () => {
    it('should extract MCP entries from mcpServers', () => {
      const profile = createClaudeDesktopProfile();
      const sourceData = {
        mcpServers: {
          'context7': {
            command: 'npx',
            args: ['@context7/mcp']
          },
          'gitlab': {
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

    it('should return empty registry for invalid data', () => {
      const profile = createClaudeDesktopProfile();
      const result = profile.mapToRegistry({ invalid: 'data' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });

  describe('readSource', () => {
    it('should read claude_desktop_config.json successfully', async () => {
      const profile = createClaudeDesktopProfile();
      const mockData = {
        mcpServers: {
          'test': { command: 'test' }
        }
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await profile.readSource();

      expect(result.success).toBe(true);
      expect(mockFs.readFile).toHaveBeenCalledWith('/home/test/Library/Application Support/Claude/claude_desktop_config.json', 'utf8');
    });

    it('should return SourceMissing error when file does not exist', async () => {
      const profile = createClaudeDesktopProfile();
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await profile.readSource();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SourceMissing');
      }
    });
  });
});