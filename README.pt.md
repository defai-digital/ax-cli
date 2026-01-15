# AX CLI - Codificação com IA de Classe Empresarial

> 📖 Esta tradução é baseada em [README.md @ v5.1.9](./README.md)

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

## Índice

- [Usuários GLM / Z.AI](#usuários-glm--zai)
- [Início Rápido](#início-rápido)
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

---

## Usuários GLM / Z.AI

> **Importante:** Z.AI lançou sua ferramenta CLI oficial chamada **OpenCode**. Recomendamos que usuários de GLM/Z.AI usem o OpenCode diretamente em vez de ax-glm. Comece com o OpenCode: https://opencode.ai. O pacote ax-glm na nuvem foi descontinuado e removido deste repositório em favor da solução oficial Z.AI.
>
> **Nota:** Os modelos GLM locais (GLM-4.6, CodeGeeX4) ainda são totalmente suportados via `ax-cli` para inferência offline através de Ollama, LMStudio ou vLLM. Consulte a seção [Modelos Locais/Offline](#modelos-locaisoffline-ax-cli) abaixo.

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Assistente de codificação com IA de nível empresarial otimizado para Grok</strong>
</p>

## Início Rápido

Comece em menos de um minuto:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Ideal para:** Pesquisa web ao vivo, visão, raciocínio estendido

Execute `/init` dentro da CLI para inicializar o contexto do seu projeto.

> **Usuários GLM/Z.AI:** Por favor, use o [OpenCode CLI](https://opencode.ai) oficial da Z.AI em vez de ax-glm.

---

## Por que AX CLI?

| Recurso | Descrição |
|---------|-----------|
| **Otimizado por Provedor** | Suporte de primeira classe para Grok (xAI) com parâmetros específicos do provedor |
| **17 Ferramentas Integradas** | Edição de arquivos, execução bash, busca, todos e mais |
| **Comportamentos Agênticos** | Loops de raciocínio ReAct, auto-correção em falhas, verificação TypeScript |
| **Agentes AutomatosX** | 20+ agentes de IA especializados para backend, frontend, segurança, DevOps e mais |
| **Correção Autônoma de Bugs** | Escaneia e corrige automaticamente vazamentos de timer, problemas de recursos, erros de tipo com segurança de rollback |
| **Refatoração Inteligente** | Remoção de código morto, correções de segurança de tipos, redução de complexidade com verificação |
| **Integração MCP** | Model Context Protocol com 12+ templates prontos para produção |
| **Memória do Projeto** | Cache de contexto inteligente com 50% de economia em tokens |
| **Segurança Empresarial** | Criptografia AES-256-GCM, sem telemetria, proteções com classificação CVSS |
| **65% Cobertura de Testes** | 6.084+ testes com TypeScript estrito |

---

### Destaques do Grok

- **Grok (ax-grok)**: Pesquisa web integrada, visão, reasoning_effort; **Variantes rápidas do Grok 4.1 incluem contexto de 2M, ferramentas de servidor paralelas, x_search e execução de código do lado do servidor**.
- A CLI compartilha a mesma cadeia de ferramentas (edição de arquivos, MCP, bash) e memória do projeto com o núcleo compartilhado.

---

## Modelos Suportados

### Grok (xAI)

| Modelo | Contexto | Recursos | Alias |
|--------|----------|----------|-------|
| `grok-4.1` | 131K | Padrão equilibrado com raciocínio, visão e busca integrados | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Ideal para sessões agênticas/intensivas em ferramentas com raciocínio | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Execuções agênticas mais rápidas sem raciocínio estendido | `grok-fast-nr` |
| `grok-4-0709` | 131K | Versão original do Grok 4 (compatível) | `grok-4` |
| `grok-2-image-1212` | 32K | **Geração de imagens**: Texto para imagem | `grok-image` |

> **Aliases de Modelos**: Use aliases convenientes como `ax-grok -m grok-latest` em vez de nomes completos de modelos.

---

## Instalação

### Requisitos

- Node.js 24.0.0+
- macOS 14+, Windows 11+ ou Ubuntu 24.04+

### Comando de Instalação

```bash
npm install -g @defai.digital/ax-grok
```

### Configuração

```bash
ax-grok setup
```

O assistente de configuração guiará você através de:
1. Criptografar e armazenar sua chave de API de forma segura (usando criptografia AES-256-GCM)
2. Configurar seu modelo de IA padrão e outras preferências
3. Validar sua configuração para garantir que tudo esteja configurado corretamente

---

## Uso

### Modo Interativo

```bash
ax-grok              # Inicia a sessão CLI interativa
ax-grok --continue   # Retomar conversa anterior
ax-grok -c           # Forma curta
```

### Modo Headless

```bash
ax-grok -p "analise esta base de código"
ax-grok -p "corrija erros TypeScript" -d /caminho/para/projeto
```

### Flags de Comportamento Agêntico

```bash
# Habilitar modo de raciocínio ReAct (ciclos Pensamento → Ação → Observação)
ax-grok --react

# Habilitar verificação TypeScript após fases de planejamento
ax-grok --verify

# Desabilitar auto-correção em falhas
ax-grok --no-correction
```

Por padrão, a auto-correção está ATIVADA (agente tenta novamente automaticamente em falhas com reflexão). ReAct e verificação estão DESATIVADOS por padrão, mas podem ser habilitados para raciocínio mais estruturado e verificações de qualidade.

### Comandos Essenciais

| Comando | Descrição |
|---------|-----------|
| `/init` | Inicializar contexto do projeto |
| `/help` | Mostrar todos os comandos |
| `/model` | Trocar modelo de IA |
| `/lang` | Mudar idioma de exibição (11 idiomas) |
| `/doctor` | Executar diagnósticos |
| `/exit` | Sair da CLI |

### Atalhos de Teclado

| Atalho | Ação | Descrição |
|--------|------|-----------|
| `Ctrl+O` | Alternar verbosidade | Mostrar ou ocultar logs detalhados e processos internos |
| `Ctrl+K` | Ações rápidas | Abrir menu de ações rápidas para comandos comuns |
| `Ctrl+B` | Modo segundo plano | Executar tarefa atual em segundo plano |
| `Shift+Tab` | Auto-edição | Acionar sugestões de código com IA |
| `Esc` ×2 | Cancelar | Limpar entrada atual ou cancelar operação em andamento |

---

## Configuração

### Arquivos de Configuração

| Arquivo | Propósito |
|---------|-----------|
| `~/.ax-grok/config.json` | Configurações do usuário (chave de API criptografada) |
| `.ax-grok/settings.json` | Substituições do projeto |
| `.ax-grok/CUSTOM.md` | Instruções personalizadas de IA |
| `ax.index.json` | Índice compartilhado do projeto (na raiz, usado por todas as CLIs) |

### Variáveis de Ambiente

```bash
# Para CI/CD
export XAI_API_KEY=your_key
```

---

## Integração MCP

Estenda capacidades com [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — um padrão aberto para conectar assistentes de IA a ferramentas externas, APIs e fontes de dados:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Templates Disponíveis:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive e mais.

---

## Extensão VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Painel de chat na barra lateral
- Visualização de diff para alterações de arquivos
- Comandos conscientes do contexto
- Sistema de checkpoints e retrocesso

---

## Integração AutomatosX

AX CLI integra-se com [AutomatosX](https://github.com/defai-digital/automatosx) - um sistema de IA multi-agente com correção autônoma de bugs, refatoração inteligente e 20+ agentes especializados.

No modo interativo (`ax-grok`), simplesmente pergunte naturalmente:

```
> por favor escaneie e corrija bugs nesta base de código

> refatore o módulo de autenticação, foque em remover código morto

> use o agente de segurança para auditar os endpoints da API
```

**O que você obtém:**
- **Correção de bugs**: Detecta vazamentos de timer, limpeza ausente, problemas de recursos - corrige automaticamente com segurança de rollback
- **Refatoração**: Remove código morto, corrige segurança de tipos, reduz complexidade - verificado por checagem de tipos
- **20+ agentes**: Backend, frontend, segurança, arquitetura, DevOps, dados e mais

---

## Memória do Projeto

Reduza custos de tokens e melhore a recuperação de contexto com cache inteligente que armazena e recupera informações relevantes do projeto, evitando processamento redundante.

```bash
ax-grok memory warmup    # Gerar cache de contexto
ax-grok memory status    # Ver distribuição de tokens
```

---

## Segurança

- **Criptografia de Chave de API:** AES-256-GCM com PBKDF2 (600K iterações)
- **Sem Telemetria:** Zero coleta de dados
- **Proteções CVSS:** Salvaguardas robustas contra vulnerabilidades comuns como Injeção de Comando (CVSS 9.8), Path Traversal (CVSS 8.6) e SSRF (CVSS 7.5)

---

## Arquitetura

AX CLI usa uma arquitetura modular com CLIs específicas por provedor construídas sobre um núcleo compartilhado:

```
┌─────────────────────────────────────────────────────────────┐
│                   Instalação do Usuário                      │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • Raciocínio estendido Grok 3                              │
│  • Padrões API xAI                                          │
│  • Pesquisa web ao vivo                                     │
│  • Configuração ~/.ax-grok/                                 │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Funcionalidade compartilhada: 17 ferramentas, cliente MCP, │
│  memória, checkpoints, React/Ink UI, operações de arquivo   │
└─────────────────────────────────────────────────────────────┘
```

---

## Pacotes

| Pacote | Instalar? | Descrição |
|--------|:---------:|-----------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Sim** | CLI otimizada para Grok com pesquisa web, visão, pensamento estendido |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Opcional | CLI local-first para Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Não | Biblioteca núcleo compartilhada (instalada automaticamente como dependência) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Não | Schemas Zod compartilhados (instalados automaticamente como dependência) |

> **Nota:** ax-glm foi descontinuado em favor do [OpenCode CLI](https://opencode.ai) oficial da Z.AI.

---

## Licença

Licença MIT - veja [LICENSE](LICENSE)

---

<p align="center">
  Feito com amor por <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
