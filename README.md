# manage_mcp

CLI ツール manage_mcp は Model Context Protocol (MCP) のレジストリエントリを作成・更新・移行するためのコマンドセットを提供します。バックアップ生成や外部ツールとのインポート／エクスポートを自動化し、ローカル設定の一貫性を保ちます。

## 特徴
- 既存の MCP レジストリ (`mcp.json`) を読み書きし、存在しない場合は自動初期化
- 追加・削除コマンドでの検証、バックアップ作成、ソート済み出力
- Claude Code / Claude Desktop / Cursor / Codex との設定インポート・エクスポート
- `--verbose` フラグによる詳細ログ出力

## 必要条件
- Node.js 20 以上
- npm もしくは互換パッケージマネージャー

## セットアップ
```bash
npm install
npm run build
```
ビルド後は `npx manage-mcp --help` で利用可能なコマンドを確認できます。開発中に継続的にコンパイルする場合は `npm run dev` を使用してください。

## 基本的な使い方
### エントリ一覧
```bash
npx manage-mcp list
```
既存エントリを名前順に表示します。レジストリが存在しない場合は `~/.manage_mcp/mcp.json` を初期化します。

### エントリ追加
ローカル実行型 (stdio) の MCP サーバーを登録する例:
```bash
npx manage-mcp add local-runner node ./scripts/server.js -- --watch
```
- 第2引数にコマンド本体 (`node` など)、第3引数以降に引数を渡します。`--` 以降は CLI のオプション解析を終了してコマンド引数として扱います。
- `--env KEY=VALUE` で環境変数を複数指定できます。
- `--project-path <path>` を付けると `project_path` フィールドを設定できます。

リモート (SSE) エンドポイントを登録する例:
```bash
npx manage-mcp add claude-remote https://example.com/mcp --transport sse \
  -H "Authorization: Bearer <TOKEN>" \
  -e "ORG_ID=12345"
```
- `--transport` に `sse` または `http` を指定すると URL ベースの登録になり、`target` 引数もしくは `--url` オプションで接続先を渡します。
- `-H/--header KEY: VALUE` でヘッダーを、`-e/--env` で環境変数を設定できます。
- scope は現状 `user` 固定です。

### エントリ削除
```bash
npx manage-mcp remove sample
```
指定エントリを削除し、変更前にバックアップ (`mcp.json.bak`) を作成します。

### 外部ツールからのインポート
```bash
npx manage-mcp import ClaudeCode --force
```
- 指定ツール (ClaudeCode / ClaudeDesktop / Cursor / Codex) からエントリを取り込みます。
- `--force` を付けると既存エントリを上書きします。

### 外部ツールへのエクスポート
```bash
npx manage-mcp export ClaudeCode Cursor
```
複数ツールを同時に指定できます。

## 設定ファイル
- 既定パスは `~/.manage_mcp/mcp.json`
- バックアップは同ディレクトリの `mcp.json.bak`
- `MCP_CONFIG_DIR` 環境変数で保存先ディレクトリを変更できます

## プロジェクト構成
- `src/cli.ts`: Commander ベースの CLI エントリポイント
- `src/services/`: 設定入出力、検証、インポート／エクスポートのビジネスロジック
- `src/source-readers/`, `src/target-writers/`: 各ツール向けアダプタ
- `src/types/`: 共有型定義
- `src/infra/logger.ts`: ログユーティリティ
- `tests/`: Vitest によるサービス／アダプタ単位の統合テスト

## 開発用スクリプト
- `npm run lint`: ESLint による静的解析
- `npm run lint:fix`: 自動修正付き ESLint
- `npm run typecheck`: TypeScript 型チェック
- `npm test`: Vitest 実行
- `npm run test:coverage`: カバレッジ計測付きテスト

## ライセンス
本リポジトリは [MIT License](./LICENSE) の下で提供されています。
