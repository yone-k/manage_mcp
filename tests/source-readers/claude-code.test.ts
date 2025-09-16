import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClaudeCodeProfile } from '../../src/services/source-readers/claude-code.js';
import type { McpRegistry } from '../../src/types/index.js';

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

describe('claude-code profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapToRegistry', () => {
    it('should extract MCP entries from top-level mcpServers', () => {
      const profile = createClaudeCodeProfile();
      const sourceData = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js']
          }
        }
      };

      const result = profile.mapToRegistry(sourceData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          'test-server': {
            command: 'node',
            args: ['server.js']
          }
        });
      }
    });

    it('should extract MCP entries from project mcpServers with prefixed names', () => {
      const profile = createClaudeCodeProfile();
      const sourceData = {
        projects: {
          '/path/to/project': {
            mcpServers: {
              'project-server': {
                command: 'docker',
                args: ['run', 'image']
              }
            }
          }
        }
      };

      const result = profile.mapToRegistry(sourceData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          'project[project].project-server': {
            command: 'docker',
            args: ['run', 'image'],
            project_path: '/path/to/project'
          }
        });
      }
    });

    it('should return empty registry for invalid data', () => {
      const profile = createClaudeCodeProfile();
      const result = profile.mapToRegistry(null);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });

  describe('readSource', () => {
    it('should read and parse ~/.claude.json successfully', async () => {
      const profile = createClaudeCodeProfile();
      const mockData = {
        mcpServers: {
          'test': { command: 'test' }
        }
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await profile.readSource();

      expect(result.success).toBe(true);
      expect(mockFs.readFile).toHaveBeenCalledWith('/home/test/.claude.json', 'utf8');
    });

    it('should return SourceMissing error when file does not exist', async () => {
      const profile = createClaudeCodeProfile();
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const result = await profile.readSource();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('SourceMissing');
      }
    });

    it('should return ParseFailed error for invalid JSON', async () => {
      const profile = createClaudeCodeProfile();
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await profile.readSource();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('ParseFailed');
      }
    });
  });
});
