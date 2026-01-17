# AX CLI - エンタープライズ級 Vibe Coding

> 📖 この翻訳は [README.md @ v5.2.0](./README.md) を基にしています

[![downloads](https://img.shields.io/npm/dt/@defai.digital/automatosx?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-6,205+%20passing-brightgreen.svg)](#)
[![macOS](https://img.shields.io/badge/macOS-26.0-blue.svg)](https://www.apple.com/macos)
[![Windows](https://img.shields.io/badge/Windows-10+-blue.svg)](https://www.microsoft.com/windows)
[![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-blue.svg)](https://ubuntu.com)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24.0.0-blue?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<p align="center">
  <a href="./README.md">English</a> |
  <a href="./README.zh-CN.md">简体中文</a> |
  <a href="./README.zh-TW.md">繁體中文</a> |
  <a href="./README.ja.md">日本語</a> |
  <a href="./README.ko.md">한국어</a> |
  <a href="./README.de.md">Deutsch</a> |
  <a href="./README.es.md">Español</a> |
  <a href="./README.pt.md">Português</a> |
  <a href="./README.fr.md">Français</a> |
  <a href="./README.vi.md">Tiếng Việt</a> |
  <a href="./README.th.md">ไทย</a>
</p>

## 目次

- [クイックスタート](#クイックスタート)
- [GLM ユーザー向け](#glm-ユーザー向け)
- [なぜ AX CLI?](#なぜ-ax-cli)
- [対応モデル](#対応モデル)
- [インストール](#インストール)
- [使い方](#使い方)
- [プロジェクト初期化](#プロジェクト初期化)
- [設定](#設定)
- [MCP 連携](#mcp-連携)
- [VSCode 拡張](#vscode-拡張)
- [AutomatosX 連携](#automatosx-連携)
- [プロジェクトメモリ](#プロジェクトメモリ)
- [セキュリティ](#セキュリティ)
- [アーキテクチャ](#アーキテクチャ)
- [パッケージ](#パッケージ)
- [変更履歴](#変更履歴)
- [ドキュメント](#ドキュメント)
- [Enterprise](#enterprise)

---

## クイックスタート

1分以内で開始できます:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最適:** ライブWeb検索、ビジョン、拡張推論、2Mコンテキスト

CLI内で `/init` を実行してプロジェクトコンテキストを初期化してください。

---

## GLM ユーザー向け

> **注意:** `ax-glm` クラウドパッケージは非推奨になりました。
>
> **GLMクラウドAPIの利用には [OpenCode](https://opencode.ai) を推奨します。**

**ローカルGLMモデル** (GLM-4.6、CodeGeeX4) は `ax-cli` により引き続き完全サポートされています。Ollama、LMStudio、vLLMでのオフライン推論に対応。詳細は [ローカル/オフラインモデル](#ローカルオフラインモデル-ax-cli) を参照してください。

---

## なぜ AX CLI?

| 特長 | 説明 |
|------|------|
| **プロバイダ最適化** | Grok (xAI) に対するプロバイダ固有パラメータを含む一次サポート |
| **17 の組み込みツール** | ファイル編集、bash 実行、検索、Todo など |
| **エージェント的動作** | ReAct 推論ループ、失敗時の自己修正、TypeScript 検証 |
| **AutomatosX エージェント** | バックエンド、フロントエンド、セキュリティ、DevOps など20以上 |
| **自動バグ修正** | タイマーリーク、リソース問題、型エラーを検出し安全に自動修正 |
| **インテリジェントなリファクタリング** | デッドコード削除、型安全性修正、複雑度削減を検証付きで実行 |
| **MCP 連携** | 12以上のプロダクション向けテンプレートを備えた Model Context Protocol |
| **プロジェクトメモリ** | 50% のトークン削減を実現する賢いコンテキストキャッシュ |
| **エンタープライズセキュリティ** | AES-256-GCM 暗号化、テレメトリなし、CVSS 評価の保護 |
| **65% テストカバレッジ** | 厳格な TypeScript で 6,205+ テスト |

---

### Grok のハイライト

- **Grok (ax-grok)**: 内蔵Web検索、ビジョン、reasoning_effort；**Grok 4.1 の高速版は 2M コンテキスト、並列サーバーツール、x_search、サーバー側コード実行を提供**。詳細は `docs/grok-4.1-advanced-features.md` を参照。

---

## 対応モデル

### Grok (xAI)

> **Grok 4.1 advanced**: ax-grok は Grok 4.1 のサーバー側エージェントツール（web_search、x_search、code_execution）を並列関数呼び出しと 2M コンテキストの高速版で有効化します。詳細は `docs/grok-4.1-advanced-features.md` を参照。

| モデル | コンテキスト | 機能 | エイリアス |
|-------|---------|------|----------|
| `grok-4.1` | 131K | 推論・ビジョン・検索を内蔵したバランス型 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 推論付きのエージェント/ツール重視セッション向け | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 拡張推論なしで最速 | `grok-fast-nr` |
| `grok-4-0709` | 131K | Grok 4 初期リリース（互換） | `grok-4` |
| `grok-2-image-1212` | 32K | **画像生成**: テキストから画像 | `grok-image` |

> **モデルエイリアス**: `ax-grok -m grok-latest` のようにエイリアスを利用できます。

### ローカル/オフラインモデル (ax-cli)

Ollama、LMStudio、vLLM を使ったローカル推論には `ax-cli` を使用します:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # ローカルサーバーURLを設定
```

ax-cli はローカルサーバーにある **任意のモデル** に対応します。設定時にモデルタグ（例: `qwen3:14b`, `glm4:9b`）を指定してください。

**推奨モデルファミリー:**

| モデル | 最適用途 |
|-------|----------|
| **Qwen** | コーディング全般で最適 |
| **GLM** | リファクタリングとドキュメント作成 |
| **DeepSeek** | 高速反復、速度/品質のバランス |
| **Codestral** | C/C++/Rust とシステム開発 |
| **Llama** | 互換性とフォールバックに最適 |

---

## インストール

### 要件

- Node.js 24.0.0+
- macOS 14+、Windows 11+、または Ubuntu 24.04+

### インストール

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### セットアップ

```bash
ax-grok setup
```

セットアップウィザードが以下をガイドします:
1. APIキーを AES-256-GCM で安全に暗号化して保存
2. 既定のAIモデルと各種設定の構成
3. 設定の検証で正しくセットアップされていることを確認

---

## 使い方

### 対話モード

```bash
ax-grok              # 対話型CLIを開始
ax-grok --continue   # 以前の会話を再開
ax-grok -c           # 短縮形
```

### ヘッドレスモード

```bash
ax-grok -p "このコードベースを分析して"
ax-grok -p "TypeScript エラーを修正して" -d /path/to/project
```

### エージェント動作フラグ

```bash
# ReAct 推論モードを有効化 (思考 → 行動 → 観測)
ax-grok --react

# 計画フェーズ後の TypeScript 検証を有効化
ax-grok --verify

# 失敗時の自己修正を無効化
ax-grok --no-correction
```

既定では自己修正が ON（失敗時に内省して再試行）です。ReAct と検証は既定で OFF ですが、より構造化された推論と品質確認のために有効化できます。

### 主要コマンド

| コマンド | 説明 |
|---------|------|
| `/init` | AX.md のプロジェクトコンテキストを生成（[プロジェクト初期化](#プロジェクト初期化) を参照） |
| `/help` | すべてのコマンドを表示 |
| `/model` | AIモデルを切り替え |
| `/lang` | 表示言語を変更（11言語） |
| `/doctor` | 診断を実行 |
| `/exit` | CLIを終了 |

### キーボードショートカット

| ショートカット | 動作 | 説明 |
|-------------|------|------|
| `Ctrl+O` | 詳細表示切替 | 詳細ログや内部プロセスの表示/非表示 |
| `Ctrl+K` | クイックアクション | クイックアクションメニューを開く |
| `Ctrl+B` | バックグラウンド | 現在のタスクをバックグラウンドで実行 |
| `Shift+Tab` | 自動編集 | AIコード提案をトリガー |
| `Esc` ×2 | キャンセル | 入力をクリアまたは操作をキャンセル |

---

## プロジェクト初期化

`/init` コマンドはプロジェクトルートに `AX.md` を生成します。これはAIがコードベースを理解するための包括的なコンテキストファイルです。

### 基本的な使い方

```bash
ax-grok
> /init                    # 標準分析（推奨）
> /init --depth=basic      # 小規模向けのクイックスキャン
> /init --depth=full       # アーキテクチャマッピング付きの詳細分析
> /init --depth=security   # セキュリティ監査（secrets/危険API）を含む
```

### 深度レベル

| 深度 | 解析内容 | 最適用途 |
|------|----------|---------|
| `basic` | 名前、言語、技術スタック、スクリプト | 迅速セットアップ、小規模プロジェクト |
| `standard` | + コード統計、テスト分析、ドキュメント | ほとんどのプロジェクト（既定） |
| `full` | + アーキテクチャ、依存関係、ホットスポット、使い方ガイド | 大規模コードベース |
| `security` | + シークレット検出、危険API検出、認証パターン | セキュリティ重視プロジェクト |

### 適応的な出力

`/init` はプロジェクトの複雑さに応じて出力の詳細度を自動調整します:

| プロジェクト規模 | ファイル数 | 典型的な出力 |
|----------------|----------|-------------|
| 小規模 | <50 ファイル | 簡潔、必要最小限のみ |
| 中規模 | 50-200 ファイル | 標準的なドキュメント |
| 大規模 | 200-500 ファイル | アーキテクチャ注記付きの詳細 |
| Enterprise | 500+ ファイル | 全セクションを網羅 |

### オプション

| オプション | 説明 |
|-----------|------|
| `--depth=<level>` | 解析深度を設定 (basic, standard, full, security) |
| `--refresh` | 既存の AX.md を最新の分析で更新 |
| `--force` | AX.md が存在しても再生成 |

### 生成されるファイル

| ファイル | 目的 |
|---------|------|
| `AX.md` | AIコンテキストの主ファイル（常に生成） |
| `.ax/analysis.json` | 詳細分析データ（full/security のみ） |

### コンテキスト注入の仕組み

会話を開始すると、AX CLI は `AX.md` を読み取り AI のコンテキストウィンドウに注入します。つまり:

1. **AI がプロジェクトを理解** - ビルドコマンド、技術スタック、規約
2. **繰り返し説明が不要** - プロジェクト構造を記憶
3. **より良いコード提案** - 既存のパターンとルールに従う

```
You run: ax-grok
         ↓
System reads: AX.md from project root
         ↓
AI receives: <project-context source="AX.md">
             # Your Project
             ## Build Commands
             pnpm build
             ...
             </project-context>
         ↓
AI understands your project before you ask anything!
```

**優先順位**（複数のコンテキストファイルがある場合）:
1. `AX.md` (推奨) - 新しい単一ファイル形式
2. `ax.summary.json` (legacy) - JSONサマリー
3. `ax.index.json` (legacy) - 完全なJSONインデックス

### レガシー形式からの移行

レガシーファイル（`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`）がある場合は以下を実行:

```bash
> /init --force
```

これにより新しい単一ファイル形式 `AX.md` が生成されます。レガシーファイルは削除可能です。

---

## 設定

### 設定ファイル

| ファイル | 目的 |
|--------|------|
| `~/.ax-grok/config.json` | ユーザー設定（暗号化されたAPIキー） |
| `.ax-grok/settings.json` | プロジェクトの上書き設定 |
| `AX.md` | プロジェクトコンテキストファイル（`/init` が生成） |

### 環境変数

```bash
# CI/CD 用
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 連携

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) で外部ツール、API、データソースと接続し機能を拡張できます:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**利用可能なテンプレート:** Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Drive など。

---

## VSCode 拡張

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- サイドバーのチャットパネル
- ファイル変更の差分プレビュー
- コンテキスト対応コマンド
- チェックポイント & 巻き戻しシステム

---

## AutomatosX 連携

AX CLI は [AutomatosX](https://github.com/defai-digital/automatosx) と連携します。AutomatosX は自律的なバグ修正、インテリジェントなリファクタリング、20+ の専門エージェントを備えたマルチエージェントAIシステムです。

対話モード (`ax-grok`) では、自然に指示できます:

```
> このコードベースのバグをスキャンして修正して

> 認証モジュールをリファクタリングし、デッドコードの削除に集中して

> セキュリティエージェントでAPIエンドポイントを監査して

> このPRDをレビューして、プロダクトエージェントと一緒に改善して

> バックエンドとフロントエンドのエージェントに共同でユーザー登録を実装させて
```

**得られるもの:**
- **バグ修正**: タイマーリーク、クリーンアップ漏れ、リソース問題を検出 - ロールバック安全で自動修正
- **リファクタリング**: デッドコード削除、型安全性修正、複雑性削減 - typecheck で検証
- **20+ エージェント**: バックエンド、フロントエンド、セキュリティ、アーキテクチャ、DevOps、データなど

エージェント一覧、詳細オプション、設定は [AutomatosX Guide](docs/AutomatosX-Integration.md) を参照

---

## プロジェクトメモリ

関連情報を保存・再利用する賢いキャッシュでトークンコストを削減し、コンテキストの想起を向上させます。

```bash
ax-grok memory warmup    # コンテキストキャッシュを生成
ax-grok memory status    # トークン分布を表示
```

---

## セキュリティ

- **APIキー暗号化:** AES-256-GCM と PBKDF2（600K 反復）
- **テレメトリなし:** データ収集ゼロ
- **CVSS 保護:** Command Injection (CVSS 9.8)、Path Traversal (CVSS 8.6)、SSRF (CVSS 7.5) などに対する強固な対策

---

## アーキテクチャ

AX CLI は共有コア上にプロバイダ別CLIを構築するモジュラー構成です:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 拡張推論                                         │
│  • xAI API defaults                                         │
│  • ライブWeb検索                                            │
│  • ~/.ax-grok/ 設定                                          │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共有機能: 17ツール, MCPクライアント, メモリ,               │
│  チェックポイント, React/Ink UI, ファイル操作, Gitサポート  │
└─────────────────────────────────────────────────────────────┘
```

---

## パッケージ

| パッケージ | インストール? | 説明 |
|-----------|:-----------:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **はい** | Web検索、ビジョン、拡張思考を備えた Grok 最適化 CLI |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 任意 | Ollama/LMStudio/vLLM + DeepSeek Cloud 用のローカルファースト CLI |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | いいえ | 共有コアライブラリ（依存として自動インストール） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | いいえ | 共有 Zod スキーマ（依存として自動インストール） |

> **GLM Cloud ユーザー:** GLM クラウド API には [OpenCode](https://opencode.ai) を推奨します。

---

## 変更履歴

| バージョン | ハイライト |
|-----------|-----------|
| **v5.2.0** | Feature: AX.md コンテキスト注入 - 起動時にプロジェクトを自動理解 |
| **v5.1.19** | パフォーマンス: 依存解析 O(N×M) → O(N+M)、キャッシュ追い出し最適化、UIバグ修正 |
| **v5.1.18** | リファクタリング: 名前付き定数、変数名統一、6,205 テスト通過 |
| **v5.1.17** | 修正: ESCキャンセルバグ、タイマーリーク、MCPタイムアウト処理 |

[GitHub で変更履歴を見る →](https://github.com/defai-digital/ax-cli/releases)

---

## ドキュメント

- [Features](docs/features.md)
- [Configuration](docs/configuration.md)
- [CLI Reference](docs/cli-reference.md)
- [MCP Integration](docs/mcp.md)
- [AutomatosX Guide](docs/AutomatosX-Integration.md)
- [VSCode Guide](docs/vscode-integration-guide.md)
- [Figma Integration](docs/figma-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Enterprise

高度な機能が必要なチーム向け:

- コンプライアンスレポート（SOC2, HIPAA）
- 監査ログの高度化
- SSO/SAML 連携
- 優先サポート（24時間SLA）

連絡先: **sales@defai.digital**

---

## ライセンス

MIT ライセンス - [LICENSE](LICENSE) を参照

---

<p align="center">
  ❤️ を込めて <a href="https://github.com/defai-digital">DEFAI Digital</a> が制作
</p>
