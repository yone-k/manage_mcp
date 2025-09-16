import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml';
import type { McpRegistry, Result, ExportError, McpEntry } from '../../types/index.js';

const CODEX_PATH = join(homedir(), '.codex/config.toml');

const stripProjectMetadata = (entry: McpEntry): Record<string, unknown> => {
  const { project_path: _projectPath, ...rest } = entry;
  return { ...rest } as Record<string, unknown>;
};

export interface CodexExporter {
  readonly write: (registry: McpRegistry) => Promise<Result<void, ExportError>>;
}

export const createCodexExporter = (): CodexExporter => {
  const write = async (registry: McpRegistry): Promise<Result<void, ExportError>> => {
    let existing: Record<string, unknown> = {};

    try {
      const content = await fs.readFile(CODEX_PATH, 'utf8');
      existing = parseToml(content) as Record<string, unknown>;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        existing = {};
      } else if (error instanceof Error && error.message) {
        return {
          success: false,
          error: {
            type: 'ParseFailed',
            message: `Invalid TOML in ${CODEX_PATH}: ${error.message}`,
            cause: error
          }
        };
      } else if (error !== null && error !== undefined) {
        return {
          success: false,
          error: {
            type: 'IOError',
            message: `Failed to read ${CODEX_PATH}: ${error}`,
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

    const updated: Record<string, unknown> = {
      ...existing,
      mcp_servers: globalEntries
    };

    try {
      type TomlInput = Parameters<typeof stringifyToml>[0];
      const content = stringifyToml(updated as unknown as TomlInput);
      await fs.writeFile(CODEX_PATH, content, 'utf8');
      return { success: true, data: undefined };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          type: 'IOError',
          message: `Failed to write ${CODEX_PATH}: ${error}`,
          cause: error
        }
      };
    }
  };

  return { write };
};
