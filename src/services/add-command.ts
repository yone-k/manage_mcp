import type { McpEntry, Result } from '../types/index.js';

export interface AddCommandOptions {
  readonly transport?: string;
  readonly env?: readonly string[];
  readonly headers?: readonly string[];
  readonly projectPath?: string;
  readonly url?: string;
  readonly command?: string;
}

export interface AddCommandInput {
  readonly name: string;
  readonly target?: string;
  readonly commandArguments: readonly string[];
  readonly options: AddCommandOptions;
}

export interface AddCommandError {
  readonly message: string;
}

const splitKeyValue = (
  value: string,
  label: string
): Result<[string, string], AddCommandError> => {
  const separators = ['=', ':'];
  const index = separators
    .map(sep => value.indexOf(sep))
    .filter(position => position >= 0)
    .sort((a, b) => a - b)[0];

  if (index === undefined) {
    return {
      success: false,
      error: { message: `${label} must be in KEY=VALUE format` }
    };
  }

  const key = value.slice(0, index).trim();
  const raw = value.slice(index + 1).trim();

  if (key.length === 0) {
    return {
      success: false,
      error: { message: `${label} key must not be empty` }
    };
  }

  return {
    success: true,
    data: [key, raw]
  };
};

const toRecord = (
  values: readonly string[] | undefined,
  label: string
): Result<Record<string, string>, AddCommandError> => {
  const entries: Record<string, string> = {};

  if (!values) {
    return { success: true, data: entries };
  }

  for (const value of values) {
    const parsed = splitKeyValue(value, label);
    if (!parsed.success) {
      return parsed;
    }

    const [key, val] = parsed.data;
    entries[key] = val;
  }

  return { success: true, data: entries };
};

const normaliseTransport = (transport?: string): string => {
  if (!transport || transport.length === 0) {
    return 'stdio';
  }

  return transport.toLowerCase();
};

const isRemoteTransport = (transport: string): boolean => {
  return transport !== 'stdio';
};

const hasEntries = (record: Record<string, string>): boolean => {
  return Object.keys(record).length > 0;
};

export const buildEntryFromCli = (
  input: AddCommandInput
): Result<McpEntry, AddCommandError> => {
  const transport = normaliseTransport(input.options.transport);
  const envResult = toRecord(input.options.env, 'env');
  if (!envResult.success) {
    return envResult;
  }

  const headersResult = toRecord(input.options.headers, 'header');
  if (!headersResult.success) {
    return headersResult;
  }

  const envRecord = envResult.data;
  const headersRecord = headersResult.data;

  if (isRemoteTransport(transport)) {
    const url = input.options.url ?? input.target;
    if (!url) {
      return {
        success: false,
        error: { message: `url is required for transport "${transport}"` }
      };
    }

    const remoteEntry: McpEntry = {
      type: transport,
      transport,
      url,
      ...(hasEntries(headersRecord) ? { headers: headersRecord } : {}),
      ...(hasEntries(envRecord) ? { env: envRecord } : {})
    };

    return {
      success: true,
      data: remoteEntry
    };
  }

  const command = input.options.command ?? input.target;
  if (!command || command.length === 0) {
    return {
      success: false,
      error: { message: 'command is required when transport is stdio' }
    };
  }

  const argsBase =
    input.options.command !== undefined
      ? [
          ...(input.target ? [input.target] : []),
          ...input.commandArguments
        ]
      : [...input.commandArguments];

  const stdioEntry: McpEntry = {
    command,
    ...(argsBase.length > 0 ? { args: argsBase } : {}),
    ...(hasEntries(envRecord) ? { env: envRecord } : {}),
    ...(input.options.projectPath ? { project_path: input.options.projectPath } : {})
  };

  return {
    success: true,
    data: stdioEntry
  };
};
