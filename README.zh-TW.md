# AX CLI - 企業級 Vibe Coding

> 📖 本翻譯基於 [README.md @ v5.2.0](./README.md)

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

## 目錄

- [快速開始](#快速開始)
- [GLM 使用者](#glm-使用者)
- [為什麼選擇 AX CLI？](#為什麼選擇-ax-cli)
- [支援的模型](#支援的模型)
- [安裝](#安裝)
- [使用](#使用)
- [專案初始化](#專案初始化)
- [設定](#設定)
- [MCP 整合](#mcp-整合)
- [VSCode 擴充](#vscode-擴充)
- [AutomatosX 整合](#automatosx-整合)
- [專案記憶](#專案記憶)
- [安全](#安全)
- [架構](#架構)
- [套件](#套件)
- [文件](#文件)
- [Enterprise](#enterprise)

---

## 快速開始

一分鐘內上手：

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最適合：**即時網路搜尋、視覺、延伸推理、2M 上下文視窗

在 CLI 中執行 `/init` 以初始化專案上下文。

---

## GLM 使用者

> **注意：**`ax-glm` 雲端套件已停用。
>
> **若需 GLM 雲端 API，建議使用 [OpenCode](https://opencode.ai)。**

**本地 GLM 模型**（GLM-4.6、CodeGeeX4）仍可透過 `ax-cli` 在 Ollama、LMStudio 或 vLLM 進行離線推論。詳見下方 [本地/離線模型](#本地離線模型-ax-cli)。

---

## 為什麼選擇 AX CLI？

| 功能 | 說明 |
|------|------|
| **供應商最佳化** | 對 Grok (xAI) 提供一等支援與供應商專屬參數 |
| **17 種內建工具** | 檔案編輯、bash 執行、搜尋、todo 等 |
| **代理行為** | ReAct 推理迴圈、失敗自我修正、TypeScript 驗證 |
| **AutomatosX 代理** | 20+ 專業代理涵蓋後端、前端、安全、DevOps 等 |
| **自動除錯** | 掃描並修復計時器洩漏、資源問題、型別錯誤，具備回滾安全 |
| **智慧重構** | 移除無用程式碼、修復型別安全、降低複雜度並驗證 |
| **MCP 整合** | Model Context Protocol，內建 12+ 生產級範本 |
| **專案記憶** | 智慧上下文快取，節省 50% Token |
| **企業級安全** | AES-256-GCM 加密、零遙測、CVSS 級別防護 |
| **65% 測試覆蓋率** | 6,205+ 測試，嚴格 TypeScript |

---

### Grok 亮點

- **Grok (ax-grok)**：內建網路搜尋、視覺、reasoning_effort；**Grok 4.1 快速版提供 2M 上下文、並行伺服器工具、x_search 與伺服器端程式碼執行**。詳見 `docs/grok-4.1-advanced-features.md`。

---

## 支援的模型

### Grok (xAI)

> **Grok 4.1 advanced**：ax-grok 啟用 Grok 4.1 的伺服器端代理工具（web_search、x_search、code_execution），支援並行函式呼叫與 2M 上下文快速版。詳見 `docs/grok-4.1-advanced-features.md`。

| 模型 | 上下文 | 功能 | 別名 |
|------|------|------|------|
| `grok-4.1` | 131K | 預設均衡，內建推理、視覺、搜尋 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 適合工具/代理密集的推理場景 | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 最快，不含延伸推理 | `grok-fast-nr` |
| `grok-4-0709` | 131K | Grok 4 初始版本（相容） | `grok-4` |
| `grok-2-image-1212` | 32K | **圖片生成**：文字轉圖片 | `grok-image` |

> **模型別名**：可使用 `ax-grok -m grok-latest` 等別名。

### 本地/離線模型 (ax-cli)

本地透過 Ollama、LMStudio 或 vLLM 推論請使用 `ax-cli`：

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # 設定本地伺服器 URL
```

ax-cli 可對接本地伺服器上的 **任何模型**。設定時指定模型標籤（如 `qwen3:14b`、`glm4:9b`）。

**推薦模型家族：**

| 模型 | 最佳用途 |
|------|--------|
| **Qwen** | 編碼任務整體最佳 |
| **GLM** | 重構與文件撰寫 |
| **DeepSeek** | 快速迭代，速度/品質平衡 |
| **Codestral** | C/C++/Rust 與系統程式設計 |
| **Llama** | 最佳相容性與備援 |

---

## 安裝

### 需求

- Node.js 24.0.0+
- macOS 14+、Windows 11+ 或 Ubuntu 24.04+

### 安裝

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### 設定

```bash
ax-grok setup
```

設定精靈會帶你完成：
1. 安全加密並儲存 API Key（AES-256-GCM）。
2. 設定預設 AI 模型與其他偏好。
3. 驗證設定，確保一切正確。

---

## 使用

### 互動模式

```bash
ax-grok              # 啟動互動式 CLI
ax-grok --continue   # 繼續先前對話
ax-grok -c           # 簡寫
```

### 無互動模式

```bash
ax-grok -p "分析這個程式碼庫"
ax-grok -p "修復 TypeScript 錯誤" -d /path/to/project
```

### 代理行為旗標

```bash
# 啟用 ReAct 推理模式（思考 → 行動 → 觀察）
ax-grok --react

# 在規劃階段後啟用 TypeScript 驗證
ax-grok --verify

# 停用失敗時自我修復
ax-grok --no-correction
```

預設自我修復為 ON（失敗時會反思並重試）。ReAct 與驗證預設為 OFF，可視需求開啟以取得更結構化的推理與品質檢查。

### 重要指令

| 指令 | 說明 |
|------|------|
| `/init` | 生成 AX.md 專案上下文（見 [專案初始化](#專案初始化)） |
| `/help` | 顯示所有指令 |
| `/model` | 切換 AI 模型 |
| `/lang` | 切換顯示語言（11 種語言） |
| `/doctor` | 執行診斷 |
| `/exit` | 離開 CLI |

### 鍵盤快捷鍵

| 快捷鍵 | 動作 | 說明 |
|-------|------|------|
| `Ctrl+O` | 切換詳細模式 | 顯示/隱藏詳細日誌與內部流程 |
| `Ctrl+K` | 快速動作 | 開啟快速動作選單 |
| `Ctrl+B` | 背景模式 | 在背景執行目前任務 |
| `Shift+Tab` | 自動編輯 | 觸發 AI 程式碼建議 |
| `Esc` ×2 | 取消 | 清除輸入或取消操作 |

---

## 專案初始化

`/init` 命令會在專案根目錄生成 `AX.md` 檔案 — 這是幫助 AI 理解你的程式碼庫的綜合上下文檔。

### 基本用法

```bash
ax-grok
> /init                    # 標準分析（推薦）
> /init --depth=basic      # 小專案快速掃描
> /init --depth=full       # 深度分析，包含架構映射
> /init --depth=security   # 包含安全稽核（secrets、危險 API）
```

### 深度等級

| 深度 | 分析內容 | 適用場景 |
|------|----------|---------|
| `basic` | 名稱、語言、技術棧、腳本 | 快速上手、小型專案 |
| `standard` | + 程式碼統計、測試分析、文件 | 大多數專案（預設） |
| `full` | + 架構、依賴、熱點、使用指南 | 大型程式碼庫 |
| `security` | + Secret 掃描、危險 API 檢測、認證模式 | 安全敏感專案 |

### 自適應輸出

`/init` 會根據專案複雜度自動調整輸出詳細度：

| 專案規模 | 檔案數 | 典型輸出 |
|---------|------|---------|
| 小型 | <50 檔案 | 簡潔，只保留必要資訊 |
| 中型 | 50-200 檔案 | 標準文件 |
| 大型 | 200-500 檔案 | 詳細，含架構註記 |
| Enterprise | 500+ 檔案 | 全面，涵蓋所有區塊 |

### 選項

| 選項 | 說明 |
|------|------|
| `--depth=<level>` | 設定分析深度 (basic, standard, full, security) |
| `--refresh` | 用最新分析更新既有 AX.md |
| `--force` | 即使 AX.md 存在也重新生成 |

### 生成檔案

| 檔案 | 用途 |
|------|------|
| `AX.md` | 主要 AI 上下文檔（一定生成） |
| `.ax/analysis.json` | 深度分析資料（僅 full/security） |

### 上下文注入如何運作

當你開始對話時，AX CLI 會自動讀取 `AX.md` 並注入到 AI 的上下文視窗。這意味著：

1. **AI 了解你的專案** - 建置指令、技術棧、規範
2. **不必重複解釋** - AI 記住專案結構
3. **更佳的程式碼建議** - 遵循既有模式與規則

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

**優先順序**（存在多個上下文檔時）：
1. `AX.md`（推薦）- 新的單檔格式
2. `ax.summary.json`（legacy）- JSON 摘要
3. `ax.index.json`（legacy）- 完整 JSON 索引

### 從舊格式遷移

若你有舊檔案（`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`），請執行：

```bash
> /init --force
```

這會生成新的單檔格式 `AX.md`。之後可刪除舊檔案。

---

## 設定

### 設定檔

| 檔案 | 目的 |
|------|------|
| `~/.ax-grok/config.json` | 使用者設定（加密 API Key） |
| `.ax-grok/settings.json` | 專案覆蓋設定 |
| `AX.md` | 專案上下文檔（由 `/init` 產生） |

### 環境變數

```bash
# CI/CD 用
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 整合

透過 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 擴展能力 — 連接 AI 助手與外部工具、API、資料來源的開放標準：

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**可用範本：**Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Drive 等。

---

## VSCode 擴充

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- 側邊欄聊天面板
- 檔案變更差異預覽
- 具上下文的指令
- Checkpoint & Rewind 系統

---

## AutomatosX 整合

AX CLI 可與 [AutomatosX](https://github.com/defai-digital/automatosx) 整合，這是一個多代理 AI 系統，具備自動修錯、智慧重構與 20+ 專業代理。

在互動模式 (`ax-grok`) 下，自然地提出需求：

```
> 請掃描並修復這個程式碼庫的錯誤

> 重構認證模組，重點移除無用程式碼

> 使用安全代理稽核 API 端點

> 審查這份 PRD，並與產品代理合作改進

> 請後端與前端代理一起實作使用者註冊
```

**你將獲得：**
- **修錯**：偵測計時器洩漏、清理缺失、資源問題 — 具備回滾安全的自動修復
- **重構**：移除無用程式碼、修復型別安全、降低複雜度 — 由 typecheck 驗證
- **20+ 代理**：後端、前端、安全、架構、DevOps、資料等

查看 [AutomatosX Guide](docs/AutomatosX-Integration.md) 了解代理列表、進階選項與設定

---

## 專案記憶

透過智慧快取儲存與擷取相關專案資訊，避免重複處理，降低 Token 成本並提升上下文回憶。

```bash
ax-grok memory warmup    # 生成上下文快取
ax-grok memory status    # 查看 Token 分佈
```

---

## 安全

- **API Key 加密：** AES-256-GCM + PBKDF2（600K 次迭代）
- **零遙測：**不收集任何資料
- **CVSS 防護：**防護常見漏洞，如命令注入（CVSS 9.8）、路徑遍歷（CVSS 8.6）、SSRF（CVSS 7.5）等

---

## 架構

AX CLI 使用模組化架構：不同供應商的 CLI 建於共享核心之上：

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 延伸推理                                         │
│  • xAI API defaults                                         │
│  • 即時網路搜尋                                             │
│  • ~/.ax-grok/ 設定                                         │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共享功能：17 工具、MCP 客戶端、記憶、checkpoints、          │
│  React/Ink UI、檔案操作、Git 支援                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 套件

| 套件 | 安裝？ | 說明 |
|------|:----:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **是** | Grok 最佳化 CLI，具網路搜尋、視覺、延伸思考 |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 選用 | 本地優先 CLI，適用 Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | 否 | 共享核心庫（作為依賴自動安裝） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | 否 | 共享 Zod schema（作為依賴自動安裝） |

> **GLM Cloud 使用者：**如需 GLM 雲端 API，推薦 [OpenCode](https://opencode.ai)。

---


## 文件

- [功能](docs/features.md)
- [設定](docs/configuration.md)
- [CLI 參考](docs/cli-reference.md)
- [MCP 整合](docs/mcp.md)
- [AutomatosX 指南](docs/AutomatosX-Integration.md)
- [VSCode 指南](docs/vscode-integration-guide.md)
- [Figma 整合](docs/figma-guide.md)
- [故障排除](docs/troubleshooting.md)

---

## Enterprise

適用於需要進階能力的團隊：

- 合規報告（SOC2、HIPAA）
- 進階稽核紀錄
- SSO/SAML 整合
- 優先支援（24 小時 SLA）

聯絡：**sales@defai.digital**

---

## 授權

MIT 授權 - 請見 [LICENSE](LICENSE)

---

<p align="center">
  由 <a href="https://github.com/defai-digital">DEFAI Digital</a> 用 ❤️ 製作
</p>
