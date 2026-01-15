# AX CLI - 企业级智能编程助手

> 📖 本翻译基于 [README.md @ v5.1.9](./README.md)

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

## 目录

- [GLM / Z.AI 用户](#glm--zai-用户)
- [快速开始](#快速开始)
- [为什么选择 AX CLI？](#为什么选择-ax-cli)
- [支持的模型](#支持的模型)
- [安装](#安装)
- [使用方法](#使用方法)
- [配置](#配置)
- [MCP 集成](#mcp-集成)
- [VSCode 扩展](#vscode-扩展)
- [AutomatosX 集成](#automatosx-集成)
- [项目记忆](#项目记忆)
- [安全性](#安全性)
- [架构](#架构)
- [软件包](#软件包)

---

## GLM / Z.AI 用户

> **重要提示：** 智谱 Z.AI 已发布其官方 CLI 工具 **OpenCode**。我们建议 GLM/Z.AI 用户直接使用 OpenCode，而非 ax-glm。前往 OpenCode 开始使用：https://opencode.ai。ax-glm 云端软件包已被弃用并从本仓库中移除，请改用官方 Z.AI 解决方案。
>
> **注意：** 本地 GLM 模型（GLM-4.6、CodeGeeX4）仍然通过 `ax-cli` 完全支持，可通过 Ollama、LMStudio 或 vLLM 进行离线推理。请参阅下方[本地/离线模型](#本地离线模型-ax-cli)部分。

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>为 Grok 优化的企业级 AI 编程助手</strong>
</p>

## 快速开始

一分钟内即可开始使用：

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**最适合：** 实时网络搜索、视觉能力、扩展推理

在 CLI 中运行 `/init` 来初始化项目上下文。

> **GLM/Z.AI 用户：** 请使用智谱官方的 [OpenCode CLI](https://opencode.ai) 代替 ax-glm。

---

## 为什么选择 AX CLI？

| 功能 | 描述 |
|------|------|
| **提供商优化** | 为 Grok (xAI) 提供一流支持，带有提供商特定参数 |
| **17 个内置工具** | 文件编辑、bash 执行、搜索、待办事项等 |
| **智能行为** | ReAct 推理循环、失败时自动纠正、TypeScript 验证 |
| **AutomatosX 智能体** | 20+ 专业 AI 智能体，覆盖后端、前端、安全、DevOps 等领域 |
| **自主修复 Bug** | 扫描并自动修复定时器泄漏、资源问题、类型错误，支持回滚 |
| **智能重构** | 死代码删除、类型安全修复、复杂度降低，带验证 |
| **MCP 集成** | 模型上下文协议，12+ 个生产就绪模板 |
| **项目记忆** | 智能上下文缓存，节省 50% Token 消耗 |
| **企业级安全** | AES-256-GCM 加密，无遥测数据收集，CVSS 级别防护 |
| **65% 测试覆盖** | 6,084+ 测试用例，严格 TypeScript |

---

### 提供商亮点 (Grok)

- **Grok (ax-grok)**：内置网络搜索、视觉、reasoning_effort；**Grok 4.1 快速变体提供 2M 上下文、并行服务器工具、x_search 和服务器端代码执行**。
- ax-grok 提供完整的工具链（文件编辑、MCP、bash）和项目记忆功能。

> **GLM/Z.AI 用户：** 请使用智谱官方的 [OpenCode CLI](https://opencode.ai)。

---

## 支持的模型

### Grok (xAI)

| 模型 | 上下文 | 功能 | 别名 |
|------|--------|------|------|
| `grok-4.1` | 131K | 平衡默认模型，内置推理、视觉、搜索 | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | 最适合智能体/工具密集型会话，带推理 | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | 最快的智能体运行，无扩展推理 | `grok-fast-nr` |
| `grok-4-0709` | 131K | 原始 Grok 4 版本（兼容） | `grok-4` |
| `grok-2-image-1212` | 32K | **图像生成**：文生图 | `grok-image` |

> **模型别名**：使用便捷别名，如 `ax-grok -m grok-latest` 代替完整模型名称。

### 本地/离线模型 (ax-cli)

通过 Ollama、LMStudio 或 vLLM 进行本地推理，使用 `ax-cli`：

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # 选择 "Local/Offline"
```

---

## 安装

### 系统要求

- Node.js 24.0.0+
- macOS 14+、Windows 11+ 或 Ubuntu 24.04+

### 安装命令

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

> **GLM/Z.AI 用户：** 请使用智谱官方的 [OpenCode CLI](https://opencode.ai)。

### 初始设置

```bash
ax-grok setup
```

设置向导将指导您完成：
1. 安全加密并存储您的 API 密钥（使用 AES-256-GCM 加密）
2. 配置默认 AI 模型和其他偏好设置
3. 验证配置以确保一切设置正确

---

## 使用方法

### 交互模式

```bash
ax-grok              # 启动交互式 CLI 会话
ax-grok --continue   # 恢复上一次对话
ax-grok -c           # 简写形式
```

### 无头模式

```bash
ax-grok -p "分析这个代码库"
ax-grok -p "修复 TypeScript 错误" -d /path/to/project
```

### 智能行为标志

```bash
# 启用 ReAct 推理模式（思考 → 行动 → 观察循环）
ax-grok --react

# 在计划阶段后启用 TypeScript 验证
ax-grok --verify

# 禁用失败时自动纠正
ax-grok --no-correction
```

默认情况下，自动纠正开启（智能体在失败时自动反思并重试）。ReAct 和验证默认关闭，但可以启用以获得更结构化的推理和质量检查。

### 常用命令

| 命令 | 描述 |
|------|------|
| `/init` | 初始化项目上下文 |
| `/help` | 显示所有命令 |
| `/model` | 切换 AI 模型 |
| `/lang` | 更改显示语言（11 种语言） |
| `/doctor` | 运行诊断 |
| `/exit` | 退出 CLI |

### 键盘快捷键

| 快捷键 | 操作 | 描述 |
|--------|------|------|
| `Ctrl+O` | 切换详细模式 | 显示或隐藏详细日志和内部过程 |
| `Ctrl+K` | 快捷操作 | 打开常用命令的快捷操作菜单 |
| `Ctrl+B` | 后台模式 | 在后台运行当前任务 |
| `Shift+Tab` | 自动编辑 | 触发 AI 驱动的代码建议 |
| `Esc` ×2 | 取消 | 清除当前输入或取消正在进行的操作 |

---

## 配置

### 配置文件

| 文件 | 用途 |
|------|------|
| `~/.ax-grok/config.json` | 用户设置（加密的 API 密钥） |
| `.ax-grok/settings.json` | 项目覆盖设置 |
| `.ax-grok/CUSTOM.md` | 自定义 AI 指令 |
| `ax.index.json` | 共享项目索引（在根目录） |

### 环境变量

```bash
# 用于 CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## MCP 集成

通过 [模型上下文协议 (MCP)](https://modelcontextprotocol.io) 扩展功能 — 一个连接 AI 助手与外部工具、API 和数据源的开放标准：

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**可用模板：** Figma、GitHub、Vercel、Puppeteer、Storybook、Sentry、Jira、Confluence、Slack、Google Drive 等。

---

## VSCode 扩展

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- 侧边栏聊天面板
- 文件更改差异预览
- 上下文感知命令
- 检查点和回滚系统

---

## AutomatosX 集成

AX CLI 与 [AutomatosX](https://github.com/defai-digital/automatosx) 集成 - 一个多智能体 AI 系统，具有自主修复 Bug、智能重构和 20+ 专业智能体。

在交互模式（`ax-grok`）中，只需自然地提问：

```
> 请扫描并修复这个代码库中的 bug

> 重构认证模块，重点删除死代码

> 使用安全智能体审计 API 端点

> 审查这个 PRD 并与产品智能体合作改进它

> 让后端和前端智能体一起实现用户注册功能
```

**您将获得：**
- **Bug 修复**：检测定时器泄漏、缺失清理、资源问题 - 自动修复并支持回滚
- **重构**：删除死代码、修复类型安全、降低复杂度 - 通过类型检查验证
- **20+ 智能体**：后端、前端、安全、架构、DevOps、数据等

详见 [AutomatosX 指南](docs/AutomatosX-Integration.md) 了解智能体列表、高级选项和配置

---

## 项目记忆

通过智能缓存减少 Token 成本并提高上下文召回率，存储和检索相关项目信息，避免冗余处理。

```bash
ax-grok memory warmup    # 生成上下文缓存
ax-grok memory status    # 查看 Token 分布
```

---

## 安全性

- **API 密钥加密：** AES-256-GCM，使用 PBKDF2（60 万次迭代）
- **无遥测：** 零数据收集
- **CVSS 防护：** 针对命令注入（CVSS 9.8）、路径遍历（CVSS 8.6）和 SSRF（CVSS 7.5）等常见漏洞的强大防护

---

## 架构

AX CLI 使用模块化架构，基于共享核心构建：

```
┌─────────────────────────────────────────────────────────────┐
│                      用户安装                                │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • Grok 3 扩展推理                                           │
│  • xAI API 默认设置                                          │
│  • 实时网络搜索                                              │
│  • ~/.ax-grok/ 配置                                         │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  共享功能：17 个工具、MCP 客户端、记忆、检查点、              │
│  React/Ink UI、文件操作、git 支持                            │
└─────────────────────────────────────────────────────────────┘
```

> **GLM/Z.AI 用户：** 请使用智谱官方的 [OpenCode CLI](https://opencode.ai)。

---

## 软件包

| 软件包 | 安装？ | 描述 |
|--------|:------:|------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **是** | Grok 优化的 CLI，带网络搜索、视觉、扩展思维 |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | 可选 | 本地优先 CLI，支持 Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | 否 | 共享核心库（作为依赖自动安装） |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | 否 | 共享 Zod 模式（作为依赖自动安装） |

> **GLM/Z.AI 用户：** ax-glm 已被弃用。请使用智谱官方的 [OpenCode CLI](https://opencode.ai)。

---

## 文档

- [功能](docs/features.md)
- [配置](docs/configuration.md)
- [CLI 参考](docs/cli-reference.md)
- [MCP 集成](docs/mcp.md)
- [AutomatosX 指南](docs/AutomatosX-Integration.md)
- [VSCode 指南](docs/vscode-integration-guide.md)
- [Figma 集成](docs/figma-guide.md)
- [故障排除](docs/troubleshooting.md)

---

## 企业版

适用于需要高级功能的团队：

- 合规报告（SOC2、HIPAA）
- 高级审计日志
- SSO/SAML 集成
- 优先支持（24 小时 SLA）

联系：**sales@defai.digital**

---

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE)

---

<p align="center">
  由 <a href="https://github.com/defai-digital">DEFAI Digital</a> 用心打造
</p>
