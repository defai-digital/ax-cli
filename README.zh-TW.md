# AX CLI - 企業級智慧編程助手

> 📖 本翻譯基於 [README.md @ v5.1.9](./README.md)

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

## 目錄

- [GLM / Z.AI 使用者](#glm--zai-使用者)
- [快速開始](#快速開始)
- [為什麼選擇 AX CLI？](#為什麼選擇-ax-cli)
- [支援的模型](#支援的模型)
- [安裝](#安裝)
- [使用方法](#使用方法)
- [設定](#設定)
- [MCP 整合](#mcp-整合)
- [VSCode 擴充功能](#vscode-擴充功能)
- [AutomatosX 整合](#automatosx-整合)
- [專案記憶](#專案記憶)
- [安全性](#安全性)
- [架構](#架構)
- [軟體套件](#軟體套件)

---

## GLM / Z.AI 使用者

> **重要提示：** 智譜 Z.AI 已發佈其官方 CLI 工具 **OpenCode**。我們建議 GLM/Z.AI 使用者直接使用 OpenCode，而非 ax-glm。前往 OpenCode 開始使用：https://opencode.ai。ax-glm 雲端軟體套件已被棄用並從本儲存庫中移除，請改用官方 Z.AI 解決方案。
>
> **注意：** 本地 GLM 模型（GLM-4.6、CodeGeeX4）仍然透過 `ax-cli` 完全支援，可透過 Ollama、LMStudio 或 vLLM 進行離線推論。請參閱下方[本地/離線模型](#本地離線模型-ax-cli)部分。

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>為 Grok 最佳化的企業級 AI 編程助手</strong>
</p>

## 快速開始

一分鐘內即可開始使用：

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最適合：** 即時網路搜尋、視覺能力、延伸推理

在 CLI 中執行 `/init` 來初始化專案上下文。

> **GLM/Z.AI 使用者：** 請使用智譜官方的 [OpenCode CLI](https://opencode.ai) 代替 ax-glm。

---

## 為什麼選擇 AX CLI？

| 功能 | 描述 |
|------|------|
| **供應商最佳化** | 為 Grok (xAI) 提供一流支援，帶有供應商特定參數 |
| **17 個內建工具** | 檔案編輯、bash 執行、搜尋、待辦事項等 |
| **智慧行為** | ReAct 推理迴圈、失敗時自動糾正、TypeScript 驗證 |
| **AutomatosX 代理** | 20+ 專業 AI 代理，涵蓋後端、前端、安全、DevOps 等領域 |
| **自主修復 Bug** | 掃描並自動修復計時器洩漏、資源問題、型別錯誤，支援回滾 |
| **智慧重構** | 死程式碼刪除、型別安全修復、複雜度降低，帶驗證 |
| **MCP 整合** | 模型上下文協定，12+ 個生產就緒範本 |
| **專案記憶** | 智慧上下文快取，節省 50% Token 消耗 |
| **企業級安全** | AES-256-GCM 加密，無遙測資料收集，CVSS 級別防護 |
| **65% 測試覆蓋** | 6,084+ 測試案例，嚴格 TypeScript |

---

### 供應商亮點 (Grok)

- **Grok (ax-grok)**：內建網路搜尋、視覺、reasoning_effort；**Grok 4.1 快速變體提供 2M 上下文、平行伺服器工具、x_search 和伺服器端程式碼執行**。
- ax-grok 提供完整的工具鏈（檔案編輯、MCP、bash）和專案記憶功能。

> **GLM/Z.AI 使用者：** 請使用智譜官方的 [OpenCode CLI](https://opencode.ai)。

---

## 支援的模型

### Grok (xAI)

| 模型 | 上下文 | 功能 | 別名 |
|------|--------|------|------|
| `grok-4.1` | 131K | 平衡預設模型，內建推理、視覺、搜尋 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 最適合代理/工具密集型會話，帶推理 | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 最快的代理執行，無延伸推理 | `grok-fast-nr` |
| `grok-4-0709` | 131K | 原始 Grok 4 版本（相容） | `grok-4` |
| `grok-2-image-1212` | 32K | **圖像生成**：文生圖 | `grok-image` |

> **模型別名**：使用便捷別名，如 `ax-grok -m grok-latest` 代替完整模型名稱。

---

## 安裝

### 系統需求

- Node.js 24.0.0+
- macOS 14+、Windows 11+ 或 Ubuntu 24.04+

### 安裝指令

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

> **GLM/Z.AI 使用者：** 請使用智譜官方的 [OpenCode CLI](https://opencode.ai)。

### 初始設定

```bash
ax-grok setup
```

設定精靈將引導您完成：
1. 安全加密並儲存您的 API 金鑰（使用 AES-256-GCM 加密）
2. 設定預設 AI 模型和其他偏好設定
3. 驗證設定以確保一切設定正確

---

## 使用方法

### 互動模式

```bash
ax-grok              # 啟動互動式 CLI 會話
ax-grok --continue   # 恢復上一次對話
ax-grok -c           # 簡寫形式
```

### 無頭模式

```bash
ax-grok -p "分析這個程式碼庫"
ax-grok -p "修復 TypeScript 錯誤" -d /path/to/project
```

### 智慧行為標誌

```bash
# 啟用 ReAct 推理模式（思考 → 行動 → 觀察迴圈）
ax-grok --react

# 在計劃階段後啟用 TypeScript 驗證
ax-grok --verify

# 停用失敗時自動糾正
ax-grok --no-correction
```

### 常用指令

| 指令 | 描述 |
|------|------|
| `/init` | 初始化專案上下文 |
| `/help` | 顯示所有指令 |
| `/model` | 切換 AI 模型 |
| `/lang` | 更改顯示語言（11 種語言） |
| `/doctor` | 執行診斷 |
| `/exit` | 退出 CLI |

### 鍵盤快捷鍵

| 快捷鍵 | 操作 | 描述 |
|--------|------|------|
| `Ctrl+O` | 切換詳細模式 | 顯示或隱藏詳細日誌和內部過程 |
| `Ctrl+K` | 快捷操作 | 開啟常用指令的快捷操作選單 |
| `Ctrl+B` | 背景模式 | 在背景執行當前任務 |
| `Shift+Tab` | 自動編輯 | 觸發 AI 驅動的程式碼建議 |
| `Esc` ×2 | 取消 | 清除當前輸入或取消正在進行的操作 |

---

## 設定

### 設定檔案

| 檔案 | 用途 |
|------|------|
| `~/.ax-grok/config.json` | 使用者設定（加密的 API 金鑰） |
| `.ax-grok/settings.json` | 專案覆寫設定 |
| `.ax-grok/CUSTOM.md` | 自訂 AI 指令 |
| `ax.index.json` | 共享專案索引（在根目錄） |

### 環境變數

```bash
# 用於 CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 整合

透過 [模型上下文協定 (MCP)](https://modelcontextprotocol.io) 擴充功能 — 一個連接 AI 助手與外部工具、API 和資料來源的開放標準：

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**可用範本：** Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Drive 等。

---

## VSCode 擴充功能

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- 側邊欄聊天面板
- 檔案變更差異預覽
- 上下文感知指令
- 檢查點和回滾系統

---

## AutomatosX 整合

AX CLI 與 [AutomatosX](https://github.com/defai-digital/automatosx) 整合 - 一個多代理 AI 系統，具有自主修復 Bug、智慧重構和 20+ 專業代理。

在互動模式（`ax-grok`）中，只需自然地提問：

```
> 請掃描並修復這個程式碼庫中的 bug

> 重構認證模組，重點刪除死程式碼

> 使用安全代理審計 API 端點
```

**您將獲得：**
- **Bug 修復**：偵測計時器洩漏、缺失清理、資源問題 - 自動修復並支援回滾
- **重構**：刪除死程式碼、修復型別安全、降低複雜度 - 透過型別檢查驗證
- **20+ 代理**：後端、前端、安全、架構、DevOps、資料等

---

## 專案記憶

透過智慧快取減少 Token 成本並提高上下文召回率，儲存和檢索相關專案資訊，避免冗餘處理。

```bash
ax-grok memory warmup    # 產生上下文快取
ax-grok memory status    # 檢視 Token 分佈
```

---

## 安全性

- **API 金鑰加密：** AES-256-GCM，使用 PBKDF2（60 萬次迭代）
- **無遙測：** 零資料收集
- **CVSS 防護：** 針對命令注入（CVSS 9.8）、路徑遍歷（CVSS 8.6）和 SSRF（CVSS 7.5）等常見漏洞的強大防護

---

## 架構

AX CLI 使用模組化架構，基於共享核心建構：

```
┌─────────────────────────────────────────────────────────────┐
│                      使用者安裝                              │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • Grok 3 延伸推理                                           │
│  • xAI API 預設設定                                          │
│  • 即時網路搜尋                                              │
│  • ~/.ax-grok/ 設定                                         │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共享功能：17 個工具、MCP 用戶端、記憶、檢查點、              │
│  React/Ink UI、檔案操作、git 支援                            │
└─────────────────────────────────────────────────────────────┘
```

> **GLM/Z.AI 使用者：** 請使用智譜官方的 [OpenCode CLI](https://opencode.ai)。

---

## 軟體套件

| 套件 | 安裝？ | 描述 |
|------|:------:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **是** | Grok 最佳化的 CLI，帶網路搜尋、視覺、延伸思維 |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 可選 | 本地優先 CLI，支援 Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | 否 | 共享核心程式庫（作為相依性自動安裝） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | 否 | 共享 Zod 模式（作為相依性自動安裝） |

> **GLM/Z.AI 使用者：** ax-glm 已被棄用。請使用智譜官方的 [OpenCode CLI](https://opencode.ai)。

---

## 授權條款

MIT 授權條款 - 詳見 [LICENSE](LICENSE)

---

<p align="center">
  由 <a href="https://github.com/defai-digital">DEFAI Digital</a> 用心打造
</p>
