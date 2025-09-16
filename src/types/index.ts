export interface McpEntry {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly type?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly transport?: string;
  readonly capabilities?: unknown;
  readonly project_path?: string;
  readonly url?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export type McpRegistry = Readonly<Record<string, McpEntry>>;

export interface McpConfig {
  readonly mcpServers: McpRegistry;
}

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

export type ImportErrorType = 'SourceMissing' | 'ParseFailed' | 'ValidationFailed' | 'IOError';

export interface ImportError {
  readonly type: ImportErrorType;
  readonly message: string;
  readonly cause?: unknown;
}

export interface SourceData {
  readonly entries: McpRegistry;
  readonly promptRequired: readonly string[];
}

export interface ToolProfile {
  readonly readSource: () => Promise<Result<SourceData, ImportError>>;
  readonly mapToRegistry: (data: unknown) => Result<McpRegistry, ImportError>;
}

export interface ImportSummary {
  readonly addedCount: number;
  readonly skippedEntries: readonly string[];
  readonly tool: string;
}

export interface OverwriteDecision {
  readonly [entryName: string]: boolean;
}

export interface ImportOptions {
  readonly force: boolean;
  readonly env: NodeJS.ProcessEnv;
}

export interface MergeOutcome {
  readonly merged: McpRegistry;
  readonly conflicts: readonly string[];
}

export type ExportErrorType = 'ParseFailed' | 'IOError' | 'Unknown';

export interface ExportError {
  readonly type: ExportErrorType;
  readonly message: string;
  readonly cause?: unknown;
}

export interface ExportOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly tools: readonly string[];
}

export interface ExportSummary {
  readonly updatedTools: readonly string[];
}
