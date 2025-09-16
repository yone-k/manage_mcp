import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ConfigPaths, McpRegistry, Result, IOError, RegistryLoad, McpEntry } from '../types/index.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isMcpEntry = (value: unknown): value is McpEntry => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.command !== 'string' || value.command.length === 0) {
    return false;
  }

  if (value.args !== undefined && (!Array.isArray(value.args) || value.args.some(arg => typeof arg !== 'string'))) {
    return false;
  }

  if (value.env !== undefined) {
    if (!isRecord(value.env)) {
      return false;
    }

    if (Object.values(value.env).some(envValue => typeof envValue !== 'string')) {
      return false;
    }
  }

  return true;
};

const parseRegistry = (raw: unknown): Result<McpRegistry, IOError> => {
  if (!isRecord(raw)) {
    return {
      success: false,
      error: {
        type: 'InvalidFormat',
        message: 'MCP configuration must be a JSON object at the top level.'
      }
    };
  }

  const registryEntries: Record<string, McpEntry> = {};

  for (const [name, entry] of Object.entries(raw)) {
    if (!isMcpEntry(entry)) {
      return {
        success: false,
        error: {
          type: 'InvalidFormat',
          message: `Invalid MCP entry for '${name}'.`
        }
      };
    }

    registryEntries[name] = entry;
  }

  return { success: true, data: registryEntries };
};

export const resolveConfigPaths = (env: NodeJS.ProcessEnv): ConfigPaths => {
  const configDir = env.MCP_CONFIG_DIR ?? join(homedir(), '.manage_mcp');
  return {
    configDir,
    configFile: join(configDir, 'mcp.json'),
    backupFile: join(configDir, 'mcp.json.bak')
  };
};

export const readRegistry = async (paths: ConfigPaths): Promise<Result<RegistryLoad, IOError>> => {
  try {
    const content = await fs.readFile(paths.configFile, 'utf8');
    const parsed = JSON.parse(content);
    const registryResult = parseRegistry(parsed);

    if (!registryResult.success) {
      return registryResult;
    }

    return {
      success: true,
      data: {
        registry: registryResult.data,
        source: 'existing'
      }
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ENOENT') {
        return {
          success: true,
          data: {
            registry: {},
            source: 'initialized'
          }
        };
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
    const content = JSON.stringify(registry, null, 2);
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
