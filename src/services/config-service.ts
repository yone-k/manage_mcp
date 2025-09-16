import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ConfigPaths, McpRegistry, McpConfig, Result, IOError } from '../types/index.js';

export const resolveConfigPaths = (env: NodeJS.ProcessEnv): ConfigPaths => {
  const configDir = env.MCP_CONFIG_DIR ?? join(homedir(), '.manage_mcp');
  return {
    configDir,
    configFile: join(configDir, 'mcp.json'),
    backupFile: join(configDir, 'mcp.json.bak')
  };
};

export const readRegistry = async (paths: ConfigPaths): Promise<Result<McpRegistry, IOError>> => {
  try {
    const content = await fs.readFile(paths.configFile, 'utf8');
    const config = JSON.parse(content) as McpConfig;
    const registry = config.mcpServers || {};
    return { success: true, data: registry };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: {} };
      }
      if (error.code === 'EACCES') {
        return {
          success: false,
          error: {
            type: 'PermissionDenied',
            message: `Permission denied reading ${paths.configFile}`,
            cause: error
          }
        };
      }
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: {
          type: 'InvalidJSON',
          message: `Invalid JSON in ${paths.configFile}: ${error.message}`,
          cause: error
        }
      };
    }

    return {
      success: false,
      error: {
        type: 'Unknown',
        message: `Failed to read ${paths.configFile}: ${error}`,
        cause: error
      }
    };
  }
};

export const writeRegistry = async (paths: ConfigPaths, registry: McpRegistry): Promise<Result<void, IOError>> => {
  try {
    await fs.mkdir(paths.configDir, { recursive: true });
    const config: McpConfig = { mcpServers: registry };
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(paths.configFile, content, 'utf8');
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        type: 'Unknown',
        message: `Failed to write ${paths.configFile}: ${error}`,
        cause: error
      }
    };
  }
};

export const ensureBackup = async (paths: ConfigPaths): Promise<Result<void, IOError>> => {
  try {
    await fs.access(paths.configFile);
    await fs.copyFile(paths.configFile, paths.backupFile);
    return { success: true, data: undefined };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { success: true, data: undefined };
    }

    return {
      success: false,
      error: {
        type: 'Unknown',
        message: `Failed to create backup: ${error}`,
        cause: error
      }
    };
  }
};