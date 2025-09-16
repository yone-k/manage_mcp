#!/usr/bin/env node

import { Command } from 'commander';
import { resolveConfigPaths, readRegistry, writeRegistry, ensureBackup } from './services/config-service.js';
import { sortEntries, addEntry, removeEntry } from './services/mcp-service.js';
import { validateEntry } from './services/validation.js';
import { createLogger } from './infra/logger.js';
import { importMcpConfig } from './services/import-service.js';
import { exportMcpConfig } from './services/export-service.js';
import { buildEntryFromCli } from './services/add-command.js';
import type { AddCommandOptions } from './services/add-command.js';
import type { McpEntry, ImportOptions, ExportOptions } from './types/index.js';

const program = new Command();

program
  .name('manage-mcp')
  .description('CLI tool for managing MCP (Model Context Protocol) configurations')
  .version('1.0.0');

program
  .option('--verbose', 'Enable verbose logging', false);

const getLogger = (): ReturnType<typeof createLogger> => {
  const options = program.opts();
  return createLogger(options.verbose);
};

const formatEntryDisplay = (name: string, entry: McpEntry): string => {
  const parts = [`${name}:`];

  if (entry.command) {
    parts.push(`  command: ${entry.command}`);
  }

  if (entry.args && entry.args.length > 0) {
    parts.push(`  args: [${entry.args.map(arg => `"${arg}"`).join(', ')}]`);
  }

  if (entry.transport) {
    parts.push(`  transport: ${entry.transport}`);
  } else if (entry.type) {
    parts.push(`  type: ${entry.type}`);
  }

  if (entry.url) {
    parts.push(`  url: ${entry.url}`);
  }

  if (entry.project_path) {
    parts.push(`  project_path: ${entry.project_path}`);
  }

  if (entry.env && Object.keys(entry.env).length > 0) {
    parts.push('  env:');
    Object.entries(entry.env).forEach(([key, value]) => {
      parts.push(`    ${key}: ${value}`);
    });
  }

  if (entry.headers && Object.keys(entry.headers).length > 0) {
    parts.push('  headers:');
    Object.entries(entry.headers).forEach(([key, value]) => {
      parts.push(`    ${key}: ${value}`);
    });
  }

  return parts.join('\n');
};

const formatValidationErrors = (errors: readonly { path: string; reason: string }[]): string => {
  const summary = `Validation failed with ${errors.length} error(s):`;
  const details = errors.map(error => `  ${error.path}: ${error.reason}`).join('\n');
  return `${summary}\n${details}`;
};

const appendOptionValue = (value: string, previous: string[] = []): string[] => {
  return [...previous, value];
};

program
  .command('list')
  .description('List all MCP entries')
  .action(async () => {
    const logger = getLogger();
    logger.info('Listing MCP entries');

    try {
      const paths = resolveConfigPaths(process.env);
      const registryResult = await readRegistry(paths);

      if (!registryResult.success) {
        logger.error(`Failed to read registry: ${registryResult.error.message}`);
        process.exit(1);
      }

      if (registryResult.data.source === 'initialized') {
        logger.info(`Initialized new MCP registry at ${paths.configFile}`);
      }

      const entries = sortEntries(registryResult.data.registry);

      if (entries.length === 0) {
        logger.info('No MCP entries found');
        return;
      }

      entries.forEach(({ name, entry }) => {
        console.log(formatEntryDisplay(name, entry));
        console.log('');
      });

      logger.info(`Total entries: ${entries.length}`);
    } catch (error) {
      logger.error(`Unexpected error: ${error}`);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a new MCP entry')
  .argument('<name>', 'Name of the MCP entry')
  .argument('[target]', 'Remote URL or first command token')
  .argument('[commandArguments...]', 'Additional command arguments')
  .option('-s, --scope <scope>', 'Configuration scope (only "user" is supported)', 'user')
  .option('--transport <transport>', 'Transport type (stdio, sse, http)', 'stdio')
  .option('--url <url>', 'Remote server URL')
  .option('-H, --header <header>', 'HTTP header in KEY=VALUE or KEY:VALUE format', appendOptionValue, [])
  .option('-e, --env <env>', 'Environment variable in KEY=VALUE format', appendOptionValue, [])
  .option('--project-path <path>', 'Project path to set in the entry')
  .option('--command <command>', 'Command to execute for stdio transport')
  .action(async (name: string, target: string | undefined, commandArguments: string[], command: Command) => {
    const logger = getLogger();
    logger.info(`Adding MCP entry: ${name}`);

    try {
      const options = command.opts<{
        readonly scope: string;
        readonly transport: string;
        readonly url?: string;
        readonly header: string[];
        readonly env: string[];
        readonly projectPath?: string;
        readonly command?: string;
      }>();

      if (options.scope && options.scope !== 'user') {
        logger.error('Only --scope user is currently supported.');
        process.exit(1);
      }

      const addOptions: AddCommandOptions = {
        transport: options.transport,
        env: options.env,
        headers: options.header,
        ...(options.projectPath ? { projectPath: options.projectPath } : {}),
        ...(options.url ? { url: options.url } : {}),
        ...(options.command ? { command: options.command } : {})
      };

      const entryResult = buildEntryFromCli({
        name,
        commandArguments,
        ...(target !== undefined ? { target } : {}),
        options: addOptions
      });

      if (!entryResult.success) {
        logger.error(entryResult.error.message);
        process.exit(1);
      }

      const entry = entryResult.data;
      const validationErrors = validateEntry(name, entry);
      if (validationErrors.length > 0) {
        logger.error(formatValidationErrors(validationErrors));
        process.exit(1);
      }

      const paths = resolveConfigPaths(process.env);
      const registryResult = await readRegistry(paths);
      if (!registryResult.success) {
        logger.error(`Failed to read registry: ${registryResult.error.message}`);
        process.exit(1);
      }

      if (registryResult.data.source === 'initialized') {
        logger.info(`Initialized new MCP registry at ${paths.configFile}`);
      }

      if (name in registryResult.data.registry) {
        logger.warn(`MCP entry '${name}' already exists and will be overwritten.`);
      }

      const backupResult = await ensureBackup(paths);
      if (!backupResult.success) {
        logger.error(`Failed to create backup: ${backupResult.error.message}`);
        process.exit(1);
      }

      const newRegistry = addEntry(registryResult.data.registry, name, entry);
      const writeResult = await writeRegistry(paths, newRegistry);

      if (!writeResult.success) {
        logger.error(`Failed to write registry: ${writeResult.error.message}`);
        process.exit(1);
      }

      logger.info(`Successfully added MCP entry: ${name}`);
      console.log(formatEntryDisplay(name, entry));
    } catch (error) {
      logger.error(`Unexpected error: ${error}`);
      process.exit(1);
    }
  });

program
  .command('remove')
  .description('Remove an MCP entry')
  .argument('<name>', 'Name of the MCP entry to remove')
  .action(async (name: string) => {
    const logger = getLogger();
    logger.info(`Removing MCP entry: ${name}`);

    try {
      const paths = resolveConfigPaths(process.env);

      // Read existing registry
      const registryResult = await readRegistry(paths);
      if (!registryResult.success) {
        logger.error(`Failed to read registry: ${registryResult.error.message}`);
        process.exit(1);
      }

      // Check if entry exists
      if (registryResult.data.source === 'initialized') {
        logger.info(`Initialized new MCP registry at ${paths.configFile}`);
      }

      if (!(name in registryResult.data.registry)) {
        logger.warn(`MCP entry '${name}' not found`);
        return;
      }

      // Create backup
      const backupResult = await ensureBackup(paths);
      if (!backupResult.success) {
        logger.error(`Failed to create backup: ${backupResult.error.message}`);
        process.exit(1);
      }

      // Remove entry and write
      const newRegistry = removeEntry(registryResult.data.registry, name);
      const writeResult = await writeRegistry(paths, newRegistry);

      if (!writeResult.success) {
        logger.error(`Failed to write registry: ${writeResult.error.message}`);
        process.exit(1);
      }

      logger.info(`Successfully removed MCP entry: ${name}`);
    } catch (error) {
      logger.error(`Unexpected error: ${error}`);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('Import MCP entries from external tool configurations')
  .argument('<tool>', 'Tool name (ClaudeCode, ClaudeDesktop, Cursor, Codex)')
  .option('--force', 'Overwrite existing entries without confirmation', false)
  .action(async (tool: string, options: { force: boolean }) => {
    const logger = getLogger();

    try {
      const importOptions: ImportOptions = {
        force: options.force,
        env: process.env
      };

      const result = await importMcpConfig(tool, importOptions);

      if (result.addedCount === 0) {
        logger.info(`No new entries were added from ${tool}`);
      } else {
      logger.info(`Successfully imported ${result.addedCount} entries from ${tool}`);
      }

      if (result.skippedEntries.length > 0) {
        logger.warn(`Skipped ${result.skippedEntries.length} existing entries: ${result.skippedEntries.join(', ')}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(`Unexpected error: ${error}`);
      }
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export MCP entries into external tool configurations')
  .argument('<tools...>', 'Tool names (ClaudeCode, ClaudeDesktop, Cursor, Codex)')
  .action(async (tools: string[]) => {
    const logger = getLogger();

    if (tools.length === 0) {
      logger.warn('No tools specified. Nothing to export.');
      return;
    }

    try {
      const exportOptions: ExportOptions = {
        env: process.env,
        tools
      };

      const summary = await exportMcpConfig(tools, exportOptions);
      if (summary.updatedTools.length === 0) {
        logger.info('No tools were updated.');
      } else {
        logger.info(`Exported MCP configuration to: ${summary.updatedTools.join(', ')}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error(`Unexpected error: ${error}`);
      }
      process.exit(1);
    }
  });

program.parse();
