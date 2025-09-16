import type { McpEntry, ValidationError } from '../types/index.js';

export const validateEntry = (name: string, entry: McpEntry): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  if (entry.command === undefined) {
    errors.push({ path: `${name}.command`, reason: 'command is required' });
  } else if (typeof entry.command !== 'string') {
    errors.push({ path: `${name}.command`, reason: 'command must be a string' });
  } else if (entry.command === '') {
    errors.push({ path: `${name}.command`, reason: 'command cannot be empty' });
  }

  if (entry.args !== undefined) {
    if (!Array.isArray(entry.args)) {
      errors.push({ path: `${name}.args`, reason: 'args must be an array' });
    } else {
      entry.args.forEach((arg, index) => {
        if (typeof arg !== 'string') {
          errors.push({ path: `${name}.args[${index}]`, reason: 'args elements must be strings' });
        }
      });
    }
  }

  if (entry.env !== undefined) {
    if (typeof entry.env !== 'object' || entry.env === null || Array.isArray(entry.env)) {
      errors.push({ path: `${name}.env`, reason: 'env must be an object' });
    } else {
      Object.entries(entry.env).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({ path: `${name}.env.${key}`, reason: 'env values must be strings' });
        }
      });
    }
  }

  return errors;
};

export const validateMcpRegistry = (registry: Record<string, McpEntry>): readonly ValidationError[] => {
  const allErrors: ValidationError[] = [];

  Object.entries(registry).forEach(([name, entry]) => {
    const entryErrors = validateEntry(name, entry);
    allErrors.push(...entryErrors);
  });

  return allErrors;
};