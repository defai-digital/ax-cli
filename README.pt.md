# AX CLI - Vibe Coding de Classe Empresarial

> 📖 Esta tradução é baseada no [README.md @ v5.1.19](./README.md)

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

## Índice

- [Início Rápido](#início-rápido)
- [Usuários GLM](#usuários-glm)
- [Por que AX CLI?](#por-que-ax-cli)
- [Modelos Suportados](#modelos-suportados)
- [Instalação](#instalação)
- [Uso](#uso)
- [Configuração](#configuração)
- [Integração MCP](#integração-mcp)
- [Extensão VSCode](#extensão-vscode)
- [Integração AutomatosX](#integração-automatosx)
- [Memória do Projeto](#memória-do-projeto)
- [Segurança](#segurança)
- [Arquitetura](#arquitetura)
- [Pacotes](#pacotes)
- [Changelog](#changelog)
- [Documentação](#documentação)
- [Enterprise](#enterprise)

---

## Início Rápido

Comece em menos de um minuto:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Ideal para:** busca na web ao vivo, visão, raciocínio estendido, janela de contexto de 2M

Execute `/init` dentro da CLI para inicializar o contexto do projeto.

---

## Usuários GLM

> **Nota:** o pacote em nuvem `ax-glm` foi descontinuado.
>
> **Para acesso à API GLM em nuvem, recomendamos usar [OpenCode](https://opencode.ai).**

**Modelos GLM locais** (GLM-4.6, CodeGeeX4) continuam totalmente suportados via `ax-cli` para inferência offline com Ollama, LMStudio ou vLLM. Veja [Modelos locais/offline](#modelos-locaisoffline-ax-cli) abaixo.

---

## Por que AX CLI?

| Recurso | Descrição |
|---------|-----------|
| **Otimizado por provedor** | Suporte de primeira classe ao Grok (xAI) com parâmetros específicos do provedor |
| **17 ferramentas integradas** | Edição de arquivos, execução de bash, busca, tarefas e mais |
| **Comportamentos agentes** | Laços de raciocínio ReAct, autocorreção em falhas, verificação TypeScript |
| **Agentes AutomatosX** | 20+ agentes especializados para backend, frontend, segurança, DevOps e mais |
| **Correção autônoma de bugs** | Detecta e corrige vazamentos de timers, problemas de recursos, erros de tipos com segurança de rollback |
| **Refatoração inteligente** | Remove código morto, corrige segurança de tipos, reduz complexidade com verificação |
| **Integração MCP** | Model Context Protocol com 12+ templates prontos para produção |
| **Memória do projeto** | Cache de contexto inteligente com 50% de economia de tokens |
| **Segurança enterprise** | Criptografia AES-256-GCM, sem telemetria, proteções com CVSS |
| **65% de cobertura de testes** | 6.205+ testes com TypeScript estrito |

---

### Destaques do Grok

- **Grok (ax-grok)**: busca web integrada, visão, reasoning_effort; **as variantes rápidas do Grok 4.1 trazem 2M de contexto, ferramentas de servidor em paralelo, x_search e execução de código no servidor**. Veja `docs/grok-4.1-advanced-features.md` para detalhes.

---

## Modelos Suportados

### Grok (xAI)

> **Grok 4.1 advanced**: o ax-grok habilita as ferramentas de agentes do servidor do Grok 4.1 (web_search, x_search, code_execution) com chamadas de função em paralelo e variantes rápidas de 2M de contexto. Veja o guia completo em `docs/grok-4.1-advanced-features.md`.

| Modelo | Contexto | Recursos | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Padrão equilibrado com raciocínio, visão, busca integrados | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Melhor para sessões agentes/ferramentas com raciocínio | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Mais rápido sem raciocínio estendido | `grok-fast-nr` |
| `grok-4-0709` | 131K | Lançamento original do Grok 4 (compatível) | `grok-4` |
| `grok-2-image-1212` | 32K | **Geração de imagens**: texto para imagem | `grok-image` |

> **Aliases de modelos**: use aliases como `ax-grok -m grok-latest` em vez de nomes completos.

### Modelos Locais/Offline (ax-cli)

Para inferência local via Ollama, LMStudio ou vLLM, use `ax-cli`:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Configure a URL do seu servidor local
```

ax-cli funciona com **qualquer modelo** disponível no seu servidor local. Basta especificar a tag do modelo ao configurar (ex.: `qwen3:14b`, `glm4:9b`).

**Famílias de modelos recomendadas:**

| Modelo | Melhor para |
|-------|------------|
| **Qwen** | Melhor no geral para tarefas de código |
| **GLM** | Refatoração e documentação |
| **DeepSeek** | Iterações rápidas, bom equilíbrio velocidade/qualidade |
| **Codestral** | C/C++/Rust e programação de sistemas |
| **Llama** | Melhor compatibilidade e fallback |

---

## Instalação

### Requisitos

- Node.js 24.0.0+
- macOS 14+, Windows 11+ ou Ubuntu 24.04+

### Instalar

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Configuração

```bash
ax-grok setup
```

O assistente de configuração guiará você em:
1. Criptografar e armazenar sua chave API com segurança (AES-256-GCM).
2. Configurar seu modelo de IA padrão e outras preferências.
3. Validar sua configuração para garantir que tudo está correto.

---

## Uso

### Modo interativo

```bash
ax-grok              # Inicia a sessão interativa do CLI
ax-grok --continue   # Retoma a conversa anterior
ax-grok -c           # Forma curta
```

### Modo headless

```bash
ax-grok -p "analise este codebase"
ax-grok -p "corrija erros de TypeScript" -d /caminho/para/projeto
```

### Flags de comportamento agente

```bash
# Ativar modo ReAct (Pensamento → Ação → Observação)
ax-grok --react

# Ativar verificação TypeScript após fases de planejamento
ax-grok --verify

# Desativar autocorreção em falhas
ax-grok --no-correction
```

Por padrão, a autocorreção está LIGADA (o agente tenta novamente com reflexão). ReAct e verificação ficam DESLIGADOS por padrão, mas podem ser ativados para raciocínio mais estruturado e checagens de qualidade.

### Comandos essenciais

| Comando | Descrição |
|---------|-----------|
| `/init` | Inicializar contexto do projeto |
| `/help` | Mostrar todos os comandos |
| `/model` | Trocar modelo de IA |
| `/lang` | Mudar idioma (11 idiomas) |
| `/doctor` | Executar diagnósticos |
| `/exit` | Sair do CLI |

### Atalhos de teclado

| Atalho | Ação | Descrição |
|-------|------|-----------|
| `Ctrl+O` | Alternar verbosidade | Mostrar/ocultar logs detalhados e processos internos |
| `Ctrl+K` | Ações rápidas | Abrir menu de ações rápidas |
| `Ctrl+B` | Modo em segundo plano | Executar a tarefa atual em segundo plano |
| `Shift+Tab` | Auto-edição | Acionar sugestões de código com IA |
| `Esc` ×2 | Cancelar | Limpar entrada ou cancelar a operação |

---

## Configuração

### Arquivos de configuração

| Arquivo | Finalidade |
|--------|------------|
| `~/.ax-grok/config.json` | Configurações do usuário (chave API criptografada) |
| `.ax-grok/settings.json` | Substituições de projeto |
| `.ax-grok/CUSTOM.md` | Instruções personalizadas de IA |
| `ax.index.json` | Índice compartilhado do projeto (raiz) |

### Variáveis de ambiente

```bash
# Para CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## Integração MCP

Estenda as capacidades com [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — um padrão aberto para conectar assistentes de IA a ferramentas externas, APIs e fontes de dados:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Templates disponíveis:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive e mais.

---

## Extensão VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Painel de chat na barra lateral
- Prévia de diff das alterações de arquivos
- Comandos sensíveis ao contexto
- Sistema de checkpoints e rewind

---

## Integração AutomatosX

AX CLI integra com [AutomatosX](https://github.com/defai-digital/automatosx), um sistema multiagente com correção autônoma de bugs, refatoração inteligente e 20+ agentes especializados.

No modo interativo (`ax-grok`), pergunte naturalmente:

```
> por favor escaneie e corrija bugs neste codebase

> refatore o módulo de autenticação, focando na remoção de código morto

> use o agente de segurança para auditar os endpoints da API

> revise este PRD e trabalhe com o agente de produto para melhorá-lo

> peça aos agentes de backend e frontend para implementarem juntos o registro de usuários
```

**O que você recebe:**
- **Correção de bugs**: Detecta vazamentos de timer, falta de limpeza, problemas de recursos - correção automática com segurança de rollback
- **Refatoração**: Remove código morto, corrige segurança de tipos, reduz complexidade - verificado por typecheck
- **20+ agentes**: Backend, frontend, segurança, arquitetura, DevOps, dados e mais

Veja o [Guia do AutomatosX](docs/AutomatosX-Integration.md) para lista de agentes, opções avançadas e configuração

---

## Memória do Projeto

Reduza custos de tokens e melhore a lembrança de contexto com cache inteligente que armazena e recupera informações relevantes do projeto, evitando processamento redundante.

```bash
ax-grok memory warmup    # Gerar cache de contexto
ax-grok memory status    # Ver distribuição de tokens
```

---

## Segurança

- **Criptografia de chave API:** AES-256-GCM com PBKDF2 (600K iterações)
- **Sem telemetria:** Zero coleta de dados
- **Proteções CVSS:** Salvaguardas robustas contra vulnerabilidades comuns como Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) e SSRF (CVSS 7.5).

---

## Arquitetura

AX CLI usa uma arquitetura modular com CLIs específicas por provedor sobre um núcleo compartilhado:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 raciocínio estendido                              │
│  • xAI API defaults                                         │
│  • Busca web ao vivo                                        │
│  • ~/.ax-grok/ configuração                                 │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Funcionalidade compartilhada: 17 ferramentas, cliente MCP, |
│  memória, checkpoints, UI React/Ink, operações de arquivo,  |
│  suporte git                                                |
└─────────────────────────────────────────────────────────────┘
```

---

## Pacotes

| Pacote | Instalar? | Descrição |
|-------|:---------:|-----------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Sim** | CLI otimizada para Grok com busca web, visão, pensamento estendido |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Opcional | CLI local-first para Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Não | Biblioteca central compartilhada (auto-instalada como dependência) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Não | Schemas Zod compartilhados (auto-instalados como dependência) |

> **Usuários GLM Cloud:** Para a API GLM Cloud, recomendamos [OpenCode](https://opencode.ai).

---

## Changelog

| Versão | Destaques |
|-------|-----------|
| **v5.1.19** | Performance: análise de dependências O(N×M) → O(N+M), expulsão de cache otimizada, correções de UI |
| **v5.1.18** | Refatoração: constantes nomeadas, nomes de variáveis unificados, 6.205 testes passando |
| **v5.1.17** | Correção: bug de cancelamento ESC, vazamentos de timer, tratamento de timeout MCP |

[Ver changelog completo no GitHub →](https://github.com/defai-digital/ax-cli/releases)

---

## Documentação

- [Recursos](docs/features.md)
- [Configuração](docs/configuration.md)
- [Referência do CLI](docs/cli-reference.md)
- [Integração MCP](docs/mcp.md)
- [Guia AutomatosX](docs/AutomatosX-Integration.md)
- [Guia VSCode](docs/vscode-integration-guide.md)
- [Integração Figma](docs/figma-guide.md)
- [Solução de problemas](docs/troubleshooting.md)

---

## Enterprise

Para equipes que precisam de capacidades avançadas:

- Relatórios de conformidade (SOC2, HIPAA)
- Auditoria avançada
- Integração SSO/SAML
- Suporte prioritário (SLA de 24 horas)

Contato: **sales@defai.digital**

---

## Licença

Licença MIT - veja [LICENSE](LICENSE)

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
