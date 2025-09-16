import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ToolProfile, Result, ImportError, SourceData, McpRegistry, McpEntry } from '../../types/index.js';

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

const deriveProjectName = (projectPath: string): string => {
  const pathParts = projectPath.split('/');
  const projectName = pathParts[pathParts.length - 1] || 'project';
  return projectName.replace(/[^a-zA-Z0-9]/g, '_');
};

export const createClaudeCodeProfile = (): ToolProfile => {
  const mapToRegistry = (data: unknown): Result<McpRegistry, ImportError> => {
    if (!isRecord(data)) {
      return { success: true, data: {} };
    }

    const registry: Record<string, McpEntry> = {};

    const rootServers = data.mcpServers;
    if (isRecord(rootServers)) {
      for (const [name, entry] of Object.entries(rootServers)) {
        if (isMcpEntry(entry)) {
          registry[name] = entry;
        }
      }
    }

    const projects = data.projects;
    if (isRecord(projects)) {
      for (const [projectPath, projectData] of Object.entries(projects)) {
        if (!isRecord(projectData)) {
          continue;
        }

        const projectServers = projectData.mcpServers;
        if (!isRecord(projectServers)) {
          continue;
        }

        const projectName = deriveProjectName(projectPath);
        for (const [name, entry] of Object.entries(projectServers)) {
          if (isMcpEntry(entry)) {
            const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const compositeName = `project[${projectName}].${sanitizedName}`;
            const enrichedEntry: McpEntry = { ...entry, project_path: projectPath };
            registry[compositeName] = enrichedEntry;
          }
        }
      }
    }

    return { success: true, data: registry };
  };

  const readSource = async (): Promise<Result<SourceData, ImportError>> => {
    const filePath = join(homedir(), '.claude.json');

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
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
            message: `ClaudeCode config file not found at ${filePath}`
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
