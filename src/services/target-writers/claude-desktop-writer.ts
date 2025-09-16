import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { McpRegistry, Result, ExportError, McpEntry } from '../../types/index.js';

const CLAUDE_DESKTOP_PATH = join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');

const stripProjectMetadata = (entry: McpEntry): Record<string, unknown> => {
  const { project_path: _projectPath, ...rest } = entry;
  return { ...rest } as Record<string, unknown>;
};

export interface ClaudeDesktopExporter {
  readonly write: (registry: McpRegistry) => Promise<Result<void, ExportError>>;
}

export const createClaudeDesktopExporter = (): ClaudeDesktopExporter => {
  const write = async (registry: McpRegistry): Promise<Result<void, ExportError>> => {
    let existing: Record<string, unknown> = {};

    try {
      const content = await fs.readFile(CLAUDE_DESKTOP_PATH, 'utf8');
      existing = JSON.parse(content) as Record<string, unknown>;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        existing = {};
      } else if (error instanceof SyntaxError) {
        return {
          success: false,
          error: {
            type: 'ParseFailed',
            message: `Invalid JSON in ${CLAUDE_DESKTOP_PATH}: ${error.message}`,
            cause: error
          }
        };
      } else if (error !== null && error !== undefined) {
        return {
          success: false,
          error: {
            type: 'IOError',
            message: `Failed to read ${CLAUDE_DESKTOP_PATH}: ${error}`,
            cause: error
          }
        };
      }
    }

    const globalEntries: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(registry)) {
      if (!entry.project_path) {
        globalEntries[name] = stripProjectMetadata(entry);
      }
    }

    const updated = {
      ...existing,
      mcpServers: globalEntries
    };

    try {
      await fs.writeFile(CLAUDE_DESKTOP_PATH, JSON.stringify(updated, null, 2), 'utf8');
      return { success: true, data: undefined };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          type: 'IOError',
          message: `Failed to write ${CLAUDE_DESKTOP_PATH}: ${error}`,
          cause: error
        }
      };
    }
  };

  return { write };
};
