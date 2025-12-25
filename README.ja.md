# AX CLI - エンタープライズグレードのAIコーディング

> 📖 この翻訳は [README.md @ v5.1.9](./README.md) に基づいています

[![downloads](https://img.shields.io/npm/dt/@defai.digital/automatosx?style=flat-square&logo=npm&label=downloads)](https://npm-stat.com/charts.html?package=%40defai.digital%2Fax-cli)
[![Tests](https://img.shields.io/badge/tests-6,084+%20passing-brightgreen.svg)](#)
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
- [なぜ AX CLI？](#なぜ-ax-cli)
- [対応モデル](#対応モデル)
- [インストール](#インストール)
- [使用方法](#使用方法)
- [設定](#設定)
- [MCP 統合](#mcp-統合)
- [VSCode 拡張機能](#vscode-拡張機能)
- [AutomatosX 統合](#automatosx-統合)
- [プロジェクトメモリ](#プロジェクトメモリ)
- [セキュリティ](#セキュリティ)
- [アーキテクチャ](#アーキテクチャ)
- [パッケージ](#パッケージ)

---

<p align="center">
  <img src=".github/assets/glm.png" alt="AX-GLM" width="400"/>
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>GLM と Grok に最適化されたエンタープライズグレードの AI コーディングアシスタント</strong>
</p>

## クイックスタート

1分以内に始められます。AIプロバイダーを選択して専用CLIをインストールしてください：

<table>
<tr>
<td width="50%">

### GLM (Z.AI)

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

**最適な用途：** 200Kコンテキスト、思考モード、中国語サポート

</td>
<td width="50%">

### Grok (xAI)

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最適な用途：** リアルタイムWeb検索、ビジョン、拡張推論

</td>
</tr>
</table>

CLI内で `/init` を実行してプロジェクトコンテキストを初期化します。

> **どのCLIをインストールすべきですか？** Z.AI APIキーをお持ちの場合は `ax-glm` を、xAI APIキーをお持ちの場合は `ax-grok` をインストールしてください。どちらも同じフル機能のコーディングアシスタントを提供し、それぞれのプロバイダーに最適化されています。

---

## なぜ AX CLI？

| 機能 | 説明 |
|------|------|
| **プロバイダー最適化** | GLM (Z.AI) と Grok (xAI) のファーストクラスサポート、プロバイダー固有のパラメータ付き |
| **17の組み込みツール** | ファイル編集、bash実行、検索、TODO管理など |
| **エージェント動作** | ReAct推論ループ、失敗時の自動修正、TypeScript検証 |
| **AutomatosX エージェント** | バックエンド、フロントエンド、セキュリティ、DevOpsなど20以上の専門AIエージェント |
| **自律的バグ修正** | タイマーリーク、リソース問題、型エラーをスキャンして自動修正、ロールバック対応 |
| **インテリジェントリファクタリング** | デッドコード削除、型安全性修正、複雑度削減を検証付きで実行 |
| **MCP統合** | 12以上の本番環境対応テンプレートを持つModel Context Protocol |
| **プロジェクトメモリ** | 50%のトークン節約を実現するインテリジェントなコンテキストキャッシング |
| **エンタープライズセキュリティ** | AES-256-GCM暗号化、テレメトリなし、CVSSレベルの保護 |
| **65%テストカバレッジ** | 6,084以上のテスト、厳格なTypeScript |

---

### プロバイダーハイライト (GLM + Grok)

- **GLM (ax-glm)**：200Kコンテキスト、**GLM 4.7** による強化された推論と改善されたコーディング、thinking_modeサポート、優れた中国語パフォーマンス、`glm-4.6v` によるビジョン、`glm-4-flash` による高速イテレーション。
- **Grok (ax-grok)**：組み込みWeb検索、ビジョン、reasoning_effort；**Grok 4.1高速バリアントは2Mコンテキスト、並列サーバーツール、x_search、サーバーサイドコード実行を提供**。
- 両CLIは同じツールチェーン（ファイル編集、MCP、bash）とプロジェクトメモリを共有；APIキーに合ったプロバイダーを選択してください。
- 両方をインストールして隔離状態（`.ax-glm`、`.ax-grok`）で並行実行し、比較テストが可能です。

---

## 対応モデル

### GLM (Z.AI)

| モデル | コンテキスト | 機能 | エイリアス |
|--------|--------------|------|------------|
| `glm-4.7` | 200K | **最新モデル**：強化された推論、改善されたコーディング、最高の総合性能 | `glm-latest` |
| `glm-4.6` | 200K | **思考モード**：詳細な思考プロセスと計画 | `glm-thinking` |
| `glm-4.6v` | 128K | **ビジョン + 思考**：ネイティブマルチモーダル関数呼び出しを持つ最新ビジョンモデル | `glm-vision` |
| `glm-4-flash` | 128K | 高速で効率的、クイックタスクに最適 | `glm-fast` |
| `cogview-4` | - | **画像生成**：可変解像度でテキストから画像を生成 | `glm-image` |

### Grok (xAI)

| モデル | コンテキスト | 機能 | エイリアス |
|--------|--------------|------|------------|
| `grok-4.1` | 131K | バランスの取れたデフォルト、組み込み推論、ビジョン、検索 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | エージェント/ツール集約型セッションに最適、推論付き | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 最速のエージェント実行、拡張推論なし | `grok-fast-nr` |
| `grok-4-0709` | 131K | オリジナルGrok 4リリース（互換） | `grok-4` |
| `grok-2-image-1212` | 32K | **画像生成**：テキストから画像を生成 | `grok-image` |

> **モデルエイリアス**：完全なモデル名の代わりに `ax-grok -m grok-latest` のような便利なエイリアスを使用できます。

---

## インストール

### 必要条件

- Node.js 24.0.0以上
- macOS 14以上、Windows 11以上、またはUbuntu 24.04以上

### インストールコマンド

```bash
# プロバイダーを選択
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### セットアップ

```bash
ax-glm setup   # または ax-grok setup
```

セットアップウィザードが以下を案内します：
1. APIキーの安全な暗号化と保存（AES-256-GCM暗号化を使用）
2. デフォルトAIモデルとその他の設定の構成
3. 設定が正しいことを確認するための検証

---

## 使用方法

### インタラクティブモード

```bash
ax-glm              # インタラクティブCLIセッションを開始
ax-glm --continue   # 前回の会話を再開
ax-glm -c           # 短縮形
```

### ヘッドレスモード

```bash
ax-glm -p "このコードベースを分析"
ax-glm -p "TypeScriptエラーを修正" -d /path/to/project
```

### エージェント動作フラグ

```bash
# ReAct推論モードを有効化（思考 → 行動 → 観察サイクル）
ax-glm --react

# 計画フェーズ後のTypeScript検証を有効化
ax-glm --verify

# 失敗時の自動修正を無効化
ax-glm --no-correction
```

デフォルトでは自動修正がオン（エージェントが失敗時に自動的にリフレクションして再試行）。ReActと検証はデフォルトでオフですが、より構造化された推論と品質チェックのために有効化できます。

### 主要コマンド

| コマンド | 説明 |
|----------|------|
| `/init` | プロジェクトコンテキストを初期化 |
| `/help` | すべてのコマンドを表示 |
| `/model` | AIモデルを切り替え |
| `/lang` | 表示言語を変更（11言語） |
| `/doctor` | 診断を実行 |
| `/exit` | CLIを終了 |

### キーボードショートカット

| ショートカット | 操作 | 説明 |
|----------------|------|------|
| `Ctrl+O` | 詳細度切り替え | 詳細ログと内部プロセスの表示/非表示 |
| `Ctrl+K` | クイックアクション | よく使うコマンドのクイックアクションメニューを開く |
| `Ctrl+B` | バックグラウンドモード | 現在のタスクをバックグラウンドで実行 |
| `Shift+Tab` | 自動編集 | AIによるコード提案をトリガー |
| `Esc` ×2 | キャンセル | 現在の入力をクリアまたは進行中の操作をキャンセル |

---

## 設定

### 設定ファイル

| ファイル | 用途 |
|----------|------|
| `~/.ax-glm/config.json` | ユーザー設定（暗号化されたAPIキー） |
| `.ax-glm/settings.json` | プロジェクトオーバーライド |
| `.ax-glm/CUSTOM.md` | カスタムAI指示 |
| `ax.index.json` | 共有プロジェクトインデックス（ルートにあり、すべてのCLIで共有） |

> Grokは `~/.ax-grok/` と `.ax-grok/` ディレクトリを使用します。`ax.index.json` は共有されます。

### 環境変数

```bash
# CI/CD用
export ZAI_API_KEY=your_key    # GLM
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 統合

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) で機能を拡張 — AIアシスタントを外部ツール、API、データソースに接続するためのオープンスタンダード：

```bash
ax-glm mcp add figma --template
ax-glm mcp add github --template
ax-glm mcp list
```

**利用可能なテンプレート：** Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Driveなど。

---

## VSCode 拡張機能

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- サイドバーチャットパネル
- ファイル変更の差分プレビュー
- コンテキスト対応コマンド
- チェックポイント＆巻き戻しシステム

---

## AutomatosX 統合

AX CLI は [AutomatosX](https://github.com/defai-digital/automatosx) と統合 - 自律的なバグ修正、インテリジェントなリファクタリング、20以上の専門エージェントを持つマルチエージェントAIシステム。

インタラクティブモード（`ax-glm` または `ax-grok`）で、自然に質問するだけ：

```
> このコードベースのバグをスキャンして修正してください

> 認証モジュールをリファクタリングして、デッドコードの削除に焦点を当ててください

> セキュリティエージェントを使ってAPIエンドポイントを監査してください
```

**得られるもの：**
- **バグ修正**：タイマーリーク、クリーンアップ漏れ、リソース問題を検出 - ロールバック対応で自動修正
- **リファクタリング**：デッドコード削除、型安全性修正、複雑度削減 - 型チェックで検証
- **20以上のエージェント**：バックエンド、フロントエンド、セキュリティ、アーキテクチャ、DevOps、データなど

---

## プロジェクトメモリ

関連するプロジェクト情報を保存・取得するインテリジェントなキャッシングでトークンコストを削減し、コンテキストの想起を改善、冗長な処理を回避。

```bash
ax-glm memory warmup    # コンテキストキャッシュを生成
ax-glm memory status    # トークン分布を表示
```

---

## セキュリティ

- **APIキー暗号化：** PBKDF2（60万回反復）を使用したAES-256-GCM
- **テレメトリなし：** データ収集ゼロ
- **CVSS保護：** コマンドインジェクション（CVSS 9.8）、パストラバーサル（CVSS 8.6）、SSRF（CVSS 7.5）などの一般的な脆弱性に対する堅牢な保護

---

## アーキテクチャ

AX CLI は共有コアに基づいてプロバイダー固有のCLIを構築するモジュラーアーキテクチャを使用：

```
┌─────────────────────────────────────────────────────────────┐
│                    ユーザーインストール                        │
├─────────────────────────────┬───────────────────────────────┤
│      @defai.digital/ax-glm  │    @defai.digital/ax-grok     │
│         (ax-glm CLI)        │       (ax-grok CLI)           │
│                             │                               │
│  • GLM-4.6 思考モード        │  • Grok 3 拡張推論             │
│  • Z.AI API デフォルト       │  • xAI API デフォルト          │
│  • 200K コンテキストウィンドウ │  • リアルタイムWeb検索          │
│  • ~/.ax-glm/ 設定          │  • ~/.ax-grok/ 設定            │
├─────────────────────────────┴───────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共有機能：17ツール、MCPクライアント、メモリ、チェックポイント、  │
│  React/Ink UI、ファイル操作、gitサポート                       │
└─────────────────────────────────────────────────────────────┘
```

---

## パッケージ

| パッケージ | インストール？ | 説明 |
|------------|:--------------:|------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | **はい** | GLM最適化CLI、Web検索、ビジョン、画像生成付き |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **はい** | Grok最適化CLI、Web検索、ビジョン、拡張思考付き |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | オプション | ローカルファーストCLI、Ollama/LMStudio/vLLM + DeepSeek Cloud対応 |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | いいえ | 共有コアライブラリ（依存関係として自動インストール） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | いいえ | 共有Zodスキーマ（依存関係として自動インストール） |

---

## ライセンス

MIT ライセンス - [LICENSE](LICENSE) を参照

---

<p align="center">
  <a href="https://github.com/defai-digital">DEFAI Digital</a> が心を込めて作成
</p>
