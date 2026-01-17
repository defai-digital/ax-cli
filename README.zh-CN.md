# AX CLI - 企业级 Vibe Coding

> 📖 本翻译基于 [README.md @ v5.2.0](./README.md)

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

## 目录

- [快速开始](#快速开始)
- [GLM 用户](#glm-用户)
- [为什么选择 AX CLI？](#为什么选择-ax-cli)
- [支持的模型](#支持的模型)
- [安装](#安装)
- [使用](#使用)
- [项目初始化](#项目初始化)
- [配置](#配置)
- [MCP 集成](#mcp-集成)
- [VSCode 扩展](#vscode-扩展)
- [AutomatosX 集成](#automatosx-集成)
- [项目记忆](#项目记忆)
- [安全](#安全)
- [架构](#架构)
- [包](#包)
- [文档](#文档)
- [Enterprise](#enterprise)

---

## 快速开始

一分钟内上手：

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最佳适用：**实时网页搜索、视觉、扩展推理、2M 上下文窗口

在 CLI 中运行 `/init` 以初始化项目上下文。

---

## GLM 用户

> **说明：** `ax-glm` 云端包已弃用。
>
> **如需 GLM 云端 API，推荐使用 [OpenCode](https://opencode.ai)。**

**本地 GLM 模型**（GLM-4.6、CodeGeeX4）仍可通过 `ax-cli` 在 Ollama、LMStudio 或 vLLM 上离线推理。参见下方 [本地/离线模型](#本地离线模型-ax-cli)。

---

## 为什么选择 AX CLI？

| 特性 | 说明 |
|------|------|
| **提供商优化** | 针对 Grok (xAI) 的一等支持，含提供商专用参数 |
| **17 个内置工具** | 文件编辑、bash 执行、搜索、TODO 等 |
| **智能体行为** | ReAct 推理循环、失败自修复、TypeScript 验证 |
| **AutomatosX 智能体** | 20+ 专业智能体覆盖后端、前端、安全、DevOps 等 |
| **自动修 Bug** | 扫描并修复计时器泄漏、资源问题、类型错误，支持回滚保护 |
| **智能重构** | 移除无用代码、修复类型安全、降低复杂度并验证 |
| **MCP 集成** | Model Context Protocol，提供 12+ 生产级模板 |
| **项目记忆** | 智能上下文缓存，节省 50% Token |
| **企业级安全** | AES-256-GCM 加密、零遥测、CVSS 级别保护 |
| **65% 测试覆盖率** | 6,205+ 测试，严格 TypeScript |

---

### Grok 亮点

- **Grok (ax-grok)**：内置网页搜索、视觉、reasoning_effort；**Grok 4.1 快速版提供 2M 上下文、并行服务器工具、x_search 与服务端代码执行**。详见 `docs/grok-4.1-advanced-features.md`。

---

## 支持的模型

### Grok (xAI)

> **Grok 4.1 advanced**：ax-grok 启用 Grok 4.1 的服务端智能体工具（web_search、x_search、code_execution），支持并行函数调用与 2M 上下文快速版本。详见 `docs/grok-4.1-advanced-features.md`。

| 模型 | 上下文 | 特性 | 别名 |
|------|------|------|------|
| `grok-4.1` | 131K | 默认均衡，内置推理、视觉、搜索 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 适合高工具/智能体场景，带推理 | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 最快，无扩展推理 | `grok-fast-nr` |
| `grok-4-0709` | 131K | Grok 4 初始版本（兼容） | `grok-4` |
| `grok-2-image-1212` | 32K | **图像生成**：文本到图像 | `grok-image` |

> **模型别名**：可使用 `ax-grok -m grok-latest` 等别名。

### 本地/离线模型 (ax-cli)

本地通过 Ollama、LMStudio 或 vLLM 推理请使用 `ax-cli`：

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # 配置本地服务器 URL
```

ax-cli 可对接本地服务器上的 **任意模型**。配置时指定模型标签（如 `qwen3:14b`、`glm4:9b`）。

**推荐模型家族：**

| 模型 | 最佳用途 |
|------|--------|
| **Qwen** | 编码任务综合表现最佳 |
| **GLM** | 重构与文档编写 |
| **DeepSeek** | 迭代快速，速度/质量均衡 |
| **Codestral** | C/C++/Rust 与系统编程 |
| **Llama** | 兼容性与兜底最佳 |

---

## 安装

### 要求

- Node.js 24.0.0+
- macOS 14+、Windows 11+ 或 Ubuntu 24.04+

### 安装

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### 配置

```bash
ax-grok setup
```

安装向导将引导你完成：
1. 安全加密并保存 API Key（AES-256-GCM）。
2. 配置默认 AI 模型与其他偏好。
3. 验证配置，确保设置正确。

---

## 使用

### 交互模式

```bash
ax-grok              # 启动交互式 CLI 会话
ax-grok --continue   # 继续上一次对话
ax-grok -c           # 简写
```

### 无交互模式

```bash
ax-grok -p "分析这个代码库"
ax-grok -p "修复 TypeScript 错误" -d /path/to/project
```

### 智能体行为开关

```bash
# 启用 ReAct 推理模式（思考 → 行动 → 观察）
ax-grok --react

# 在规划阶段后启用 TypeScript 验证
ax-grok --verify

# 禁用失败时自我修复
ax-grok --no-correction
```

默认开启自我修复（失败后会反思并重试）。ReAct 与验证默认关闭，可按需开启以获得更结构化的推理和更好的质量检查。

### 常用命令

| 命令 | 说明 |
|------|------|
| `/init` | 生成 AX.md 项目上下文（见 [项目初始化](#项目初始化)） |
| `/help` | 显示全部命令 |
| `/model` | 切换 AI 模型 |
| `/lang` | 切换显示语言（11 种语言） |
| `/doctor` | 运行诊断 |
| `/exit` | 退出 CLI |

### 快捷键

| 快捷键 | 动作 | 说明 |
|-------|------|------|
| `Ctrl+O` | 切换详细模式 | 显示/隐藏详细日志与内部流程 |
| `Ctrl+K` | 快速操作 | 打开快速操作菜单 |
| `Ctrl+B` | 后台模式 | 将当前任务转到后台运行 |
| `Shift+Tab` | 自动编辑 | 触发 AI 代码建议 |
| `Esc` ×2 | 取消 | 清除输入或取消当前操作 |

---

## 项目初始化

`/init` 命令会在项目根目录生成 `AX.md` 文件 — 这是帮助 AI 理解你代码库的综合上下文文件。

### 基本用法

```bash
ax-grok
> /init                    # 标准分析（推荐）
> /init --depth=basic      # 小项目快速扫描
> /init --depth=full       # 深度分析，包含架构映射
> /init --depth=security   # 包含安全审计（secrets、危险 API）
```

### 深度等级

| 深度 | 分析内容 | 适用场景 |
|------|----------|---------|
| `basic` | 名称、语言、技术栈、脚本 | 快速上手、小型项目 |
| `standard` | + 代码统计、测试分析、文档 | 大多数项目（默认） |
| `full` | + 架构、依赖、热点、使用指南 | 大型代码库 |
| `security` | + Secret 扫描、危险 API 检测、认证模式 | 安全敏感项目 |

### 自适应输出

`/init` 会根据项目复杂度自动调整输出详细度：

| 项目规模 | 文件数 | 典型输出 |
|---------|------|---------|
| 小型 | <50 文件 | 简洁，仅保留关键内容 |
| 中型 | 50-200 文件 | 标准文档 |
| 大型 | 200-500 文件 | 详细，含架构说明 |
| Enterprise | 500+ 文件 | 全面，包含所有部分 |

### 选项

| 选项 | 说明 |
|------|------|
| `--depth=<level>` | 设置分析深度 (basic, standard, full, security) |
| `--refresh` | 用最新分析更新现有 AX.md |
| `--force` | 即便 AX.md 已存在也重新生成 |

### 生成文件

| 文件 | 用途 |
|------|------|
| `AX.md` | 主要 AI 上下文文件（始终生成） |
| `.ax/analysis.json` | 深度分析数据（仅 full/security） |

### 上下文注入如何工作

当你开始对话时，AX CLI 会自动读取 `AX.md` 并注入到 AI 的上下文窗口中。这意味着：

1. **AI 了解你的项目** - 构建命令、技术栈、约定
2. **无需重复解释** - AI 记住项目结构
3. **更好的代码建议** - 遵循现有模式与规则

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

**优先级顺序**（存在多个上下文文件时）：
1. `AX.md`（推荐）- 新的单文件格式
2. `ax.summary.json`（legacy）- JSON 摘要
3. `ax.index.json`（legacy）- 完整 JSON 索引

### 从旧格式迁移

如果你有旧文件（`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`），请运行：

```bash
> /init --force
```

这会生成新的单文件格式 `AX.md`。随后可以删除旧文件。

---

## 配置

### 配置文件

| 文件 | 用途 |
|------|------|
| `~/.ax-grok/config.json` | 用户设置（加密 API Key） |
| `.ax-grok/settings.json` | 项目级覆盖配置 |
| `AX.md` | 项目上下文文件（由 `/init` 生成） |

### 环境变量

```bash
# 用于 CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 集成

通过 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 扩展能力 — 一个用于连接 AI 助手与外部工具、API、数据源的开放标准：

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**可用模板：**Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Drive 等。

---

## VSCode 扩展

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- 侧边栏聊天面板
- 文件变更的差异预览
- 上下文感知命令
- Checkpoint & Rewind 系统

---

## AutomatosX 集成

AX CLI 可与 [AutomatosX](https://github.com/defai-digital/automatosx) 集成，这是一个多智能体 AI 系统，具备自动修复、智能重构与 20+ 专业智能体。

在交互模式 (`ax-grok`) 下，直接自然地提出需求：

```
> 请扫描并修复这个代码库中的漏洞

> 重构认证模块，重点移除无用代码

> 使用安全智能体审计 API 端点

> 审阅这份 PRD，并与产品智能体协作改进

> 请后端与前端智能体协作实现用户注册
```

**你将获得：**
- **修复 Bug**：检测计时器泄漏、缺失清理、资源问题 — 自动修复并支持回滚
- **重构**：移除无用代码、修复类型安全、降低复杂度 — 通过 typecheck 验证
- **20+ 智能体**：后端、前端、安全、架构、DevOps、数据等

查看 [AutomatosX Guide](docs/AutomatosX-Integration.md) 了解智能体列表、高级选项与配置

---

## 项目记忆

通过智能缓存存储并检索相关项目信息，避免重复处理，降低 Token 成本并提升上下文回忆。

```bash
ax-grok memory warmup    # 生成上下文缓存
ax-grok memory status    # 查看 Token 分布
```

---

## 安全

- **API Key 加密：** AES-256-GCM + PBKDF2（600K 次迭代）
- **零遥测：**不收集任何数据
- **CVSS 保护：**防护常见漏洞，如命令注入（CVSS 9.8）、路径遍历（CVSS 8.6）、SSRF（CVSS 7.5）等

---

## 架构

AX CLI 使用模块化架构：不同提供商的 CLI 建于共享核心之上：

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 扩展推理                                         │
│  • xAI API defaults                                         │
│  • 实时网页搜索                                             │
│  • ~/.ax-grok/ 配置                                         │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共享功能：17 工具、MCP 客户端、记忆、checkpoints、          │
│  React/Ink UI、文件操作、Git 支持                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 包

| 包 | 安装？ | 说明 |
|----|:----:|-----|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **是** | Grok 优化版 CLI，含网页搜索、视觉、扩展思考 |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 可选 | 本地优先 CLI，适配 Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | 否 | 共享核心库（作为依赖自动安装） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | 否 | 共享 Zod schema（作为依赖自动安装） |

> **GLM Cloud 用户：**如需 GLM 云 API，推荐 [OpenCode](https://opencode.ai)。

---


## 文档

- [功能特性](docs/features.md)
- [配置](docs/configuration.md)
- [CLI 参考](docs/cli-reference.md)
- [MCP 集成](docs/mcp.md)
- [AutomatosX 指南](docs/AutomatosX-Integration.md)
- [VSCode 指南](docs/vscode-integration-guide.md)
- [Figma 集成](docs/figma-guide.md)
- [故障排查](docs/troubleshooting.md)

---

## Enterprise

适用于需要高级能力的团队：

- 合规报告（SOC2、HIPAA）
- 高级审计日志
- SSO/SAML 集成
- 优先支持（24 小时 SLA）

联系：**sales@defai.digital**

---

## 许可证

MIT 许可证 - 见 [LICENSE](LICENSE)

---

<p align="center">
  由 <a href="https://github.com/defai-digital">DEFAI Digital</a> 用 ❤️ 制作
</p>
