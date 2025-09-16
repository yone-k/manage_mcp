import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ToolProfile, Result, ExtractError, SourceData, McpRegistry, McpEntry } from '../../types/index.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isMcpEntry = (value: unknown): value is McpEntry => {
  if (!isRecord(value) || typeof value.command !== 'string' || value.command.length === 0) {
    return false;
  }

  if (value.project_path !== undefined && typeof value.project_path !== 'string') {
    return false;
  }

  return true;
};

export const createClaudeDesktopProfile = (): ToolProfile => {
  const mapToRegistry = (data: unknown): Result<McpRegistry, ExtractError> => {
    if (!isRecord(data) || !isRecord(data.mcpServers)) {
      return { success: true, data: {} };
    }

    const registry: Record<string, McpEntry> = {};

    Object.entries(data.mcpServers).forEach(([name, entry]) => {
      if (isMcpEntry(entry)) {
        registry[name] = entry;
      }
    });

    return { success: true, data: registry };
  };

  const readSource = async (): Promise<Result<SourceData, ExtractError>> => {
    const filePath = join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content);
      const registryResult = mapToRegistry(parsed);

      if (!registryResult.success) {
        return registryResult;
      }

      return {
        success: true,
        data: {
          entries: registryResult.data,
          promptRequired: Object.keys(registryResult.data)
        }
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return {
          success: false,
          error: {
            type: 'SourceMissing',
            message: `ClaudeDesktop config file not found at ${filePath}`
          }
        };
      }

      if (error instanceof SyntaxError) {
        return {
          success: false,
          error: {
            type: 'ParseFailed',
            message: `Invalid JSON in ${filePath}: ${error.message}`,
            cause: error
          }
        };
      }

      return {
        success: false,
        error: {
          type: 'IOError',
          message: `Failed to read ${filePath}: ${error}`,
          cause: error
        }
      };
    }
  };

  return { readSource, mapToRegistry };
};
