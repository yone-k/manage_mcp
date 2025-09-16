import { resolveConfigPaths, readRegistry } from './config-service.js';
import { createLogger } from '../infra/logger.js';
import { createClaudeCodeExporter } from './target-writers/claude-code-writer.js';
import { createClaudeDesktopExporter } from './target-writers/claude-desktop-writer.js';
import { createCursorExporter } from './target-writers/cursor-writer.js';
import { createCodexExporter } from './target-writers/codex-writer.js';
import type {
  Result,
  ExportError,
  ExportSummary,
  ExportOptions,
  McpRegistry
} from '../types/index.js';

export interface ToolExporter {
  readonly write: (registry: McpRegistry) => Promise<Result<void, ExportError>>;
}

export const resolveExporter = (tool: string): Result<ToolExporter, ExportError> => {
  switch (tool) {
    case 'ClaudeCode':
      return { success: true, data: createClaudeCodeExporter() };
    case 'ClaudeDesktop':
      return { success: true, data: createClaudeDesktopExporter() };
    case 'Cursor':
      return { success: true, data: createCursorExporter() };
    case 'Codex':
      return { success: true, data: createCodexExporter() };
    default:
      return {
        success: false,
        error: {
          type: 'Unknown',
          message: `Unsupported tool: ${tool}`
        }
      };
  }
};

export const exportMcpConfig = async (
  tools: readonly string[],
  options: ExportOptions
): Promise<ExportSummary> => {
  const logger = createLogger(false);
  logger.info(`Exporting MCP entries to tools: ${tools.join(', ')}`);

  const paths = resolveConfigPaths(options.env);
  const registryResult = await readRegistry(paths);

  if (!registryResult.success) {
    logger.error(`Failed to read registry: ${registryResult.error.message}`);
    throw new Error(registryResult.error.message);
  }

  const registry = registryResult.data.registry;
  const updatedTools: string[] = [];

  for (const tool of tools) {
    const exporterResult = resolveExporter(tool);
    if (!exporterResult.success) {
      logger.error(exporterResult.error.message);
      throw new Error(exporterResult.error.message);
    }

    const writeResult = await exporterResult.data.write(registry);
    if (!writeResult.success) {
      logger.error(writeResult.error.message);
      throw new Error(writeResult.error.message);
    }

    updatedTools.push(tool);
  }

  logger.info(`Exported MCP entries to ${updatedTools.length} tool(s).`);

  return {
    updatedTools
  };
};
