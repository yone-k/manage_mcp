import type { McpEntry, ValidationError } from '../types/index.js';

export const validateEntry = (name: string, entry: McpEntry): readonly ValidationError[] => {
  const errors: ValidationError[] = [];

  const transport = entry.transport ?? entry.type;
  const isRemoteTransport = transport === 'sse' || transport === 'http';

  if (entry.command === undefined) {
    if (!isRemoteTransport) {
      errors.push({ path: `${name}.command`, reason: 'command is required' });
    }
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

  if (entry.url !== undefined) {
    if (typeof entry.url !== 'string' || entry.url === '') {
      errors.push({ path: `${name}.url`, reason: 'url must be a non-empty string' });
    }
  } else if (isRemoteTransport) {
    errors.push({ path: `${name}.url`, reason: `url is required for transport "${transport}"` });
  }

  if (entry.headers !== undefined) {
    if (typeof entry.headers !== 'object' || entry.headers === null || Array.isArray(entry.headers)) {
      errors.push({ path: `${name}.headers`, reason: 'headers must be an object' });
    } else {
      Object.entries(entry.headers).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({ path: `${name}.headers.${key}`, reason: 'header values must be strings' });
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
