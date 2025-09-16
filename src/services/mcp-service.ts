import type { McpRegistry, McpEntry } from '../types/index.js';

export interface RegistryEntry {
  readonly name: string;
  readonly entry: McpEntry;
}

export const sortEntries = (registry: McpRegistry): readonly RegistryEntry[] => {
  return Object.entries(registry)
    .map(([name, entry]) => ({ name, entry }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const addEntry = (registry: McpRegistry, name: string, entry: McpEntry): McpRegistry => {
  return {
    ...registry,
    [name]: entry
  };
};

export const removeEntry = (registry: McpRegistry, name: string): McpRegistry => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [name]: _, ...newRegistry } = registry;
  return newRegistry;
};