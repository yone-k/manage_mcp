export interface McpEntry {
  readonly command: string;
  readonly args?: readonly string[];
  readonly type?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly transport?: string;
  readonly capabilities?: unknown;
}

export type McpRegistry = Readonly<Record<string, McpEntry>>;

export interface ConfigPaths {
  readonly configFile: string;
  readonly backupFile: string;
  readonly configDir: string;
}

export interface ValidationError {
  readonly path: string;
  readonly reason: string;
}

export type Result<T, E> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export interface IOError {
  readonly type: 'FileNotFound' | 'PermissionDenied' | 'InvalidJSON' | 'InvalidFormat' | 'Unknown';
  readonly message: string;
  readonly cause?: unknown;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface Logger {
  readonly debug: (message: string) => void;
  readonly info: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
}

export interface RegistryLoad {
  readonly registry: McpRegistry;
  readonly source: 'existing' | 'initialized';
}
