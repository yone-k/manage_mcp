import { describe, it, expect } from 'vitest';
import { sortEntries, addEntry, removeEntry } from '../src/services/mcp-service.js';
import type { McpRegistry } from '../src/types/index.js';

describe('sortEntries', () => {
  it('should return empty array for empty registry', () => {
    const registry: McpRegistry = {};
    const result = sortEntries(registry);
    expect(result).toEqual([]);
  });

  it('should return entries sorted by name', () => {
    const registry: McpRegistry = {
      'zebra': { command: 'z' },
      'alpha': { command: 'a' },
      'beta': { command: 'b' }
    };
    const result = sortEntries(registry);
    expect(result).toEqual([
      { name: 'alpha', entry: { command: 'a' } },
      { name: 'beta', entry: { command: 'b' } },
      { name: 'zebra', entry: { command: 'z' } }
    ]);
  });

  it('should handle complex entries with all fields', () => {
    const registry: McpRegistry = {
      'complex': {
        command: 'docker',
        args: ['run', '-i'],
        type: 'stdio',
        env: { 'API_KEY': 'test' }
      },
      'simple': { command: 'npx' }
    };
    const result = sortEntries(registry);
    expect(result).toEqual([
      {
        name: 'complex',
        entry: {
          command: 'docker',
          args: ['run', '-i'],
          type: 'stdio',
          env: { 'API_KEY': 'test' }
        }
      },
      { name: 'simple', entry: { command: 'npx' } }
    ]);
  });
});

describe('addEntry', () => {
  it('should add entry to empty registry', () => {
    const registry: McpRegistry = {};
    const entry = { command: 'docker' };
    const result = addEntry(registry, 'test', entry);

    expect(result).toEqual({
      'test': { command: 'docker' }
    });
    expect(registry).toEqual({}); // Original should be unchanged
  });

  it('should add entry to existing registry', () => {
    const registry: McpRegistry = {
      'existing': { command: 'npx' }
    };
    const entry = { command: 'docker' };
    const result = addEntry(registry, 'new', entry);

    expect(result).toEqual({
      'existing': { command: 'npx' },
      'new': { command: 'docker' }
    });
    expect(registry).toEqual({
      'existing': { command: 'npx' }
    }); // Original should be unchanged
  });

  it('should overwrite existing entry with same name', () => {
    const registry: McpRegistry = {
      'test': { command: 'old' }
    };
    const entry = { command: 'new' };
    const result = addEntry(registry, 'test', entry);

    expect(result).toEqual({
      'test': { command: 'new' }
    });
  });

  it('should handle complex entries', () => {
    const registry: McpRegistry = {};
    const entry = {
      command: 'docker',
      args: ['run', '-i', '--rm'],
      type: 'stdio',
      env: { 'API_KEY': 'test123' }
    };
    const result = addEntry(registry, 'complex', entry);

    expect(result).toEqual({
      'complex': entry
    });
  });
});

describe('removeEntry', () => {
  it('should remove existing entry', () => {
    const registry: McpRegistry = {
      'keep': { command: 'keep' },
      'remove': { command: 'remove' }
    };
    const result = removeEntry(registry, 'remove');

    expect(result).toEqual({
      'keep': { command: 'keep' }
    });
    expect(registry).toEqual({
      'keep': { command: 'keep' },
      'remove': { command: 'remove' }
    }); // Original should be unchanged
  });

  it('should return unchanged registry when entry does not exist', () => {
    const registry: McpRegistry = {
      'existing': { command: 'test' }
    };
    const result = removeEntry(registry, 'nonexistent');

    expect(result).toEqual({
      'existing': { command: 'test' }
    });
    expect(registry).toEqual({
      'existing': { command: 'test' }
    }); // Original should be unchanged
  });

  it('should return empty registry when removing last entry', () => {
    const registry: McpRegistry = {
      'only': { command: 'test' }
    };
    const result = removeEntry(registry, 'only');

    expect(result).toEqual({});
  });

  it('should handle empty registry', () => {
    const registry: McpRegistry = {};
    const result = removeEntry(registry, 'nonexistent');

    expect(result).toEqual({});
  });
});