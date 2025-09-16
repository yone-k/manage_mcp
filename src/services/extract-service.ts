import { resolveConfigPaths, readRegistry, writeRegistry, ensureBackup } from './config-service.js';
import { createLogger } from '../infra/logger.js';
import { createInterface } from 'readline/promises';
import { createClaudeCodeProfile } from './source-readers/claude-code.js';
import { createClaudeDesktopProfile } from './source-readers/claude-desktop.js';
import { createCursorProfile } from './source-readers/cursor.js';
import { createCodexProfile } from './source-readers/codex.js';
import type {
  Result,
  ExtractError,
  ToolProfile,
  ExtractOptions,
  ExtractionSummary,
  OverwriteDecision,
  McpRegistry,
  McpEntry,
  MergeOutcome
} from '../types/index.js';

export const resolveProfile = (tool: string): Result<ToolProfile, ExtractError> => {
  switch (tool) {
    case 'ClaudeCode':
      return { success: true, data: createClaudeCodeProfile() };
    case 'ClaudeDesktop':
      return { success: true, data: createClaudeDesktopProfile() };
    case 'Cursor':
      return { success: true, data: createCursorProfile() };
    case 'Codex':
      return { success: true, data: createCodexProfile() };
    default:
      return {
        success: false,
        error: {
          type: 'ValidationFailed',
          message: `Unsupported tool: ${tool}. Supported tools: ClaudeCode, ClaudeDesktop, Cursor, Codex`
        }
      };
  }
};

export const promptOverwrite = async (
  names: readonly string[],
  force: boolean,
  promptFn: (names: readonly string[]) => Promise<OverwriteDecision>
): Promise<OverwriteDecision> => {
  if (force) {
    return names.reduce((acc, name) => ({ ...acc, [name]: true }), {});
  }

  return await promptFn(names);
};

export const mergeEntries = (
  base: McpRegistry,
  additions: McpRegistry,
  decisions: OverwriteDecision
): MergeOutcome => {
  const conflicts: string[] = [];
  const merged: Record<string, McpEntry> = { ...base };

  Object.entries(additions).forEach(([name, entry]) => {
    if (name in base) {
      conflicts.push(name);
      if (decisions[name]) {
        merged[name] = entry;
      }
    } else {
      merged[name] = entry;
    }
  });

  return { merged, conflicts };
};

const defaultPromptFn = async (names: readonly string[]): Promise<OverwriteDecision> => {
  if (names.length === 0) {
    return {};
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const message = `The following entries already exist and may be overwritten: ${names.join(', ')}\nContinue? (y/N): `;
    const answer = await rl.question(message);
    const normalized = answer.trim().toLowerCase();
    const accepted = normalized === 'y' || normalized === 'yes';

    return names.reduce<OverwriteDecision>((acc, name) => ({ ...acc, [name]: accepted }), {});
  } finally {
    rl.close();
  }
};

export const extractMcpConfig = async (
  tool: string,
  options: ExtractOptions,
  promptFn: (names: readonly string[]) => Promise<OverwriteDecision> = defaultPromptFn
): Promise<ExtractionSummary> => {
  const logger = createLogger(false);

  logger.info(`Extracting MCP configuration from ${tool}`);

  // Resolve tool profile
  const profileResult = resolveProfile(tool);
  if (!profileResult.success) {
    logger.error(profileResult.error.message);
    throw new Error(profileResult.error.message);
  }

  const profile = profileResult.data;

  // Read source configuration
  const sourceResult = await profile.readSource();
  if (!sourceResult.success) {
    if (sourceResult.error.type === 'SourceMissing') {
      logger.info(`No MCP entries found for ${tool} (source file not found)`);
      return { tool, addedCount: 0, skippedEntries: [] };
    }
    logger.error(`Failed to read source: ${sourceResult.error.message}`);
    throw new Error(sourceResult.error.message);
  }

  const sourceData = sourceResult.data;
  logger.debug(`Found ${Object.keys(sourceData.entries).length} MCP entries in source`);

  // Read existing registry
  const paths = resolveConfigPaths(options.env);
  const registryResult = await readRegistry(paths);
  if (!registryResult.success) {
    logger.error(`Failed to read registry: ${registryResult.error.message}`);
    throw new Error(registryResult.error.message);
  }

  if (registryResult.data.source === 'initialized') {
    logger.info(`Initialized new MCP registry at ${paths.configFile}`);
  }

  // Merge entries and handle conflicts
  const tempMerge = mergeEntries(registryResult.data.registry, sourceData.entries, {});
  let decisions: OverwriteDecision = {};

  if (tempMerge.conflicts.length > 0) {
    decisions = await promptOverwrite(tempMerge.conflicts, options.force, promptFn);
  }

  const finalMerge = mergeEntries(registryResult.data.registry, sourceData.entries, decisions);
  const skippedEntries = tempMerge.conflicts.filter(name => !decisions[name]);

  if (skippedEntries.length > 0) {
    skippedEntries.forEach(name => {
      logger.warn(`Skipped overwriting existing entry: ${name}`);
    });
  }

  // Create backup and write registry
  const backupResult = await ensureBackup(paths);
  if (!backupResult.success) {
    logger.error(`Failed to create backup: ${backupResult.error.message}`);
    throw new Error(backupResult.error.message);
  }

  const writeResult = await writeRegistry(paths, finalMerge.merged);
  if (!writeResult.success) {
    logger.error(`Failed to write registry: ${writeResult.error.message}`);
    throw new Error(writeResult.error.message);
  }

  const addedCount = Object.keys(sourceData.entries).length - skippedEntries.length;
  logger.info(`Successfully added ${addedCount} MCP entries from ${tool}`);

  Object.entries(sourceData.entries).forEach(([name, entry]) => {
    if (!skippedEntries.includes(name)) {
      logger.debug(`Added: ${name} (command: ${entry.command})`);
    }
  });

  return {
    tool,
    addedCount,
    skippedEntries
  };
};
