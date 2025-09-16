import { describe, it, expect } from 'vitest';
import { buildEntryFromCli } from '../src/services/add-command.js';
import type { AddCommandInput } from '../src/services/add-command.js';

describe('buildEntryFromCli', () => {
  it('creates stdio entry with command, args, env, and project path', () => {
    const input: AddCommandInput = {
      name: 'local-tool',
      target: 'node',
      commandArguments: ['script.js', '--watch'],
      options: {
        transport: 'stdio',
        env: ['API_KEY=secret'],
        headers: [],
        projectPath: '/workspace/project'
      }
    };

    const result = buildEntryFromCli(input);
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      command: 'node',
      args: ['script.js', '--watch'],
      env: { API_KEY: 'secret' },
      project_path: '/workspace/project'
    });
  });

  it('creates sse entry with url and headers', () => {
    const input: AddCommandInput = {
      name: 'remote-sse',
      target: 'https://example.com/sse',
      commandArguments: [],
      options: {
        transport: 'sse',
        env: [],
        headers: ['Authorization: Bearer token']
      }
    };

    const result = buildEntryFromCli(input);
    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      type: 'sse',
      transport: 'sse',
      url: 'https://example.com/sse',
      headers: { Authorization: 'Bearer token' }
    });
  });

  it('fails when stdio entry lacks command', () => {
    const input: AddCommandInput = {
      name: 'local-tool',
      target: undefined,
      commandArguments: [],
      options: {
        transport: 'stdio',
        env: [],
        headers: []
      }
    };

    const result = buildEntryFromCli(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('command');
    }
  });

  it('fails when remote entry lacks url', () => {
    const input: AddCommandInput = {
      name: 'remote-sse',
      target: undefined,
      commandArguments: [],
      options: {
        transport: 'sse',
        env: [],
        headers: []
      }
    };

    const result = buildEntryFromCli(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('url');
    }
  });

  it('fails when header format is invalid', () => {
    const input: AddCommandInput = {
      name: 'remote-sse',
      target: 'https://example.com',
      commandArguments: [],
      options: {
        transport: 'sse',
        env: [],
        headers: ['invalid-header']
      }
    };

    const result = buildEntryFromCli(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('header');
    }
  });
});
