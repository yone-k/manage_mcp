import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCursorProfile } from '../../src/services/source-readers/cursor.js';

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

describe('cursor profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapToRegistry', () => {
    it('should import MCP entries from mcpServers', () => {
      const profile = createCursorProfile();
      const sourceData = {
        mcpServers: {
          'playwright': {
            command: 'npx',
            args: ['@playwright/mcp']
          }
        }
      };

      const result = profile.mapToRegistry(sourceData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          'playwright': {
            command: 'npx',
            args: ['@playwright/mcp']
          }
        });
      }
    });
  });

  describe('readSource', () => {
    it('should read ~/.cursor/mcp.json successfully', async () => {
      const profile = createCursorProfile();
      const mockData = {
        mcpServers: {
          'test': { command: 'test' }
        }
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await profile.readSource();

      expect(result.success).toBe(true);
      expect(mockFs.readFile).toHaveBeenCalledWith('/home/test/.cursor/mcp.json', 'utf8');
    });
  });
});