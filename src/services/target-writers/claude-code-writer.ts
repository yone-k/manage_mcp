import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { McpRegistry, Result, ExportError, McpEntry } from '../../types/index.js';

const CLAUDE_CODE_PATH = join(homedir(), '.claude.json');

const stripProjectMetadata = (entry: McpEntry): Record<string, unknown> => {
  const { project_path: _projectPath, ...rest } = entry;
  return { ...rest } as Record<string, unknown>;
};

const deriveProjectName = (projectPath: string): string => {
  const segments = projectPath.split('/');
  const projectName = segments[segments.length - 1] || projectPath;
  return projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
};

const getMcpName = (entryName: string, projectName: string): string => {
  const marker = `project[${projectName}].`;
  if (entryName.startsWith(marker)) {
    return entryName.slice(marker.length);
  }
  const lastSeparator = entryName.lastIndexOf('.');
  if (lastSeparator >= 0 && lastSeparator < entryName.length - 1) {
    return entryName.slice(lastSeparator + 1);
  }
  return entryName;
};

export interface ClaudeCodeExporter {
  readonly write: (registry: McpRegistry) => Promise<Result<void, ExportError>>;
}

export const createClaudeCodeExporter = (): ClaudeCodeExporter => {
  const write = async (registry: McpRegistry): Promise<Result<void, ExportError>> => {
    let existing: Record<string, unknown> = {};

    try {
      const content = await fs.readFile(CLAUDE_CODE_PATH, 'utf8');
      existing = JSON.parse(content) as Record<string, unknown>;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        existing = {};
      } else if (error instanceof SyntaxError) {
        return {
          success: false,
          error: {
            type: 'ParseFailed',
            message: `Invalid JSON in ${CLAUDE_CODE_PATH}: ${error.message}`,
            cause: error
          }
        };
      } else if (error !== null && error !== undefined) {
        return {
          success: false,
          error: {
            type: 'IOError',
            message: `Failed to read ${CLAUDE_CODE_PATH}: ${error}`,
            cause: error
          }
        };
      }
    }

    const globalEntries: Record<string, unknown> = {};
    const projectGroups: Record<string, Record<string, unknown>> = {};

    for (const [entryName, entry] of Object.entries(registry)) {
      const { project_path: projectPath } = entry;
      if (projectPath) {
        const normalizedPath = projectPath;
        const projectName = deriveProjectName(normalizedPath);
        const mcpName = getMcpName(entryName, projectName);
        if (!projectGroups[normalizedPath]) {
          projectGroups[normalizedPath] = {};
        }
        projectGroups[normalizedPath][mcpName] = stripProjectMetadata(entry);
      } else {
        globalEntries[entryName] = stripProjectMetadata(entry);
      }
    }

    const updated: Record<string, unknown> = {
      ...existing,
      mcpServers: globalEntries
    };

    if (Object.keys(projectGroups).length > 0) {
      const projectsSection = { ...(existing.projects as Record<string, unknown> | undefined) };

      for (const [path, entries] of Object.entries(projectGroups)) {
        const projectName = deriveProjectName(path);
        const currentProject = (projectsSection?.[path] as Record<string, unknown>) ?? {
          name: projectName
        };
        projectsSection[path] = {
          ...currentProject,
          mcpServers: entries
        };
      }

      updated.projects = projectsSection;
    }

    try {
      await fs.writeFile(CLAUDE_CODE_PATH, JSON.stringify(updated, null, 2), 'utf8');
      return { success: true, data: undefined };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          type: 'IOError',
          message: `Failed to write ${CLAUDE_CODE_PATH}: ${error}`,
          cause: error
        }
      };
    }
  };

  return { write };
};
