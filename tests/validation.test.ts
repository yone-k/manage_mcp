import { describe, it, expect } from 'vitest';
import { validateEntry, validateMcpRegistry } from '../src/services/validation.js';
import type { McpEntry, ValidationError } from '../src/types/index.js';

describe('validateEntry', () => {
  it('should return empty array for valid entry with command only', () => {
    const entry: McpEntry = {
      command: 'docker'
    };
    const result = validateEntry('test', entry);
    expect(result).toEqual([]);
  });

  it('should return error for missing command', () => {
    const entry = {} as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.command', reason: 'command is required' }
    ]);
  });

  it('should return error for empty command', () => {
    const entry: McpEntry = {
      command: ''
    };
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.command', reason: 'command cannot be empty' }
    ]);
  });

  it('should return error for non-string command', () => {
    const entry = {
      command: 123
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.command', reason: 'command must be a string' }
    ]);
  });

  it('should return empty array for valid entry with args', () => {
    const entry: McpEntry = {
      command: 'docker',
      args: ['run', '-i', '--rm']
    };
    const result = validateEntry('test', entry);
    expect(result).toEqual([]);
  });

  it('should return error for non-array args', () => {
    const entry = {
      command: 'docker',
      args: 'invalid'
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.args', reason: 'args must be an array' }
    ]);
  });

  it('should return error for args with non-string elements', () => {
    const entry = {
      command: 'docker',
      args: ['run', 123, '--rm']
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.args[1]', reason: 'args elements must be strings' }
    ]);
  });

  it('should return empty array for valid entry with env', () => {
    const entry: McpEntry = {
      command: 'docker',
      env: { 'API_KEY': 'test123' }
    };
    const result = validateEntry('test', entry);
    expect(result).toEqual([]);
  });

  it('should return error for non-object env', () => {
    const entry = {
      command: 'docker',
      env: 'invalid'
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.env', reason: 'env must be an object' }
    ]);
  });

  it('should return error for env with non-string values', () => {
    const entry = {
      command: 'docker',
      env: { 'API_KEY': 123 }
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toEqual([
      { path: 'test.env.API_KEY', reason: 'env values must be strings' }
    ]);
  });

  it('should return multiple errors for multiple validation failures', () => {
    const entry = {
      command: '',
      args: 'invalid',
      env: { 'KEY': 123 }
    } as unknown as McpEntry;
    const result = validateEntry('test', entry);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ path: 'test.command', reason: 'command cannot be empty' });
    expect(result).toContainEqual({ path: 'test.args', reason: 'args must be an array' });
    expect(result).toContainEqual({ path: 'test.env.KEY', reason: 'env values must be strings' });
  });
});

describe('validateMcpRegistry', () => {
  it('should return empty array for valid registry', () => {
    const registry = {
      'test1': { command: 'docker' },
      'test2': { command: 'npx', args: ['test'] }
    };
    const result = validateMcpRegistry(registry);
    expect(result).toEqual([]);
  });

  it('should return errors for invalid entries in registry', () => {
    const registry = {
      'valid': { command: 'docker' },
      'invalid': { command: '' }
    } as unknown as Record<string, McpEntry>;
    const result = validateMcpRegistry(registry);
    expect(result).toEqual([
      { path: 'invalid.command', reason: 'command cannot be empty' }
    ]);
  });

  it('should collect all validation errors from multiple entries', () => {
    const registry = {
      'entry1': { command: '' },
      'entry2': { command: 'valid' },
      'entry3': { args: 'invalid' }
    } as unknown as Record<string, McpEntry>;
    const result = validateMcpRegistry(registry);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ path: 'entry1.command', reason: 'command cannot be empty' });
    expect(result).toContainEqual({ path: 'entry3.command', reason: 'command is required' });
    expect(result).toContainEqual({ path: 'entry3.args', reason: 'args must be an array' });
  });
});