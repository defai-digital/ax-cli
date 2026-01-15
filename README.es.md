# AX CLI - Codificación con IA de Clase Empresarial

> 📖 Esta traducción está basada en [README.md @ v5.1.9](./README.md)

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

## Tabla de Contenidos

- [Usuarios de GLM / Z.AI](#usuarios-de-glm--zai)
- [Inicio Rápido](#inicio-rápido)
- [¿Por qué AX CLI?](#por-qué-ax-cli)
- [Modelos Soportados](#modelos-soportados)
- [Instalación](#instalación)
- [Uso](#uso)
- [Configuración](#configuración)
- [Integración MCP](#integración-mcp)
- [Extensión VSCode](#extensión-vscode)
- [Integración AutomatosX](#integración-automatosx)
- [Memoria del Proyecto](#memoria-del-proyecto)
- [Seguridad](#seguridad)
- [Arquitectura](#arquitectura)
- [Paquetes](#paquetes)

---

## Usuarios de GLM / Z.AI

> **Importante:** Z.AI ha lanzado su herramienta CLI oficial llamada **OpenCode**. Recomendamos a los usuarios de GLM/Z.AI usar OpenCode directamente en lugar de ax-glm. Comienza con OpenCode: https://opencode.ai. El paquete ax-glm en la nube ha sido descontinuado y eliminado de este repositorio en favor de la solución oficial de Z.AI.
>
> **Nota:** Los modelos GLM locales (GLM-4.6, CodeGeeX4) siguen siendo totalmente compatibles a través de `ax-cli` para inferencia sin conexión mediante Ollama, LMStudio o vLLM. Consulta la sección [Modelos Locales/Sin Conexión](#modelos-localessin-conexión-ax-cli) a continuación.

---

<p align="center">
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Asistente de codificación con IA de nivel empresarial optimizado para Grok</strong>
</p>

## Inicio Rápido

Comienza en menos de un minuto:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Ideal para:** Búsqueda web en vivo, visión, razonamiento extendido

Ejecuta `/init` dentro de la CLI para inicializar el contexto de tu proyecto.

> **Usuarios de GLM/Z.AI:** Por favor usa el [OpenCode CLI](https://opencode.ai) oficial de Z.AI en lugar de ax-glm.

---

## ¿Por qué AX CLI?

| Característica | Descripción |
|----------------|-------------|
| **Optimizado por Proveedor** | Soporte de primera clase para Grok (xAI) con parámetros específicos del proveedor |
| **17 Herramientas Integradas** | Edición de archivos, ejecución bash, búsqueda, todos y más |
| **Comportamientos Agénticos** | Bucles de razonamiento ReAct, auto-corrección en fallos, verificación TypeScript |
| **Agentes AutomatosX** | 20+ agentes de IA especializados para backend, frontend, seguridad, DevOps y más |
| **Corrección Autónoma de Bugs** | Escanea y corrige automáticamente fugas de temporizadores, problemas de recursos, errores de tipo con seguridad de rollback |
| **Refactorización Inteligente** | Eliminación de código muerto, correcciones de seguridad de tipos, reducción de complejidad con verificación |
| **Integración MCP** | Model Context Protocol con 12+ plantillas listas para producción |
| **Memoria del Proyecto** | Caché de contexto inteligente con 50% de ahorro en tokens |
| **Seguridad Empresarial** | Cifrado AES-256-GCM, sin telemetría, protecciones con clasificación CVSS |
| **65% Cobertura de Tests** | 6,084+ tests con TypeScript estricto |

---

### Destacados de Grok

- **Grok (ax-grok)**: Búsqueda web integrada, visión, reasoning_effort; **Las variantes rápidas de Grok 4.1 incluyen contexto de 2M, herramientas de servidor paralelas, x_search y ejecución de código del lado del servidor**.
- La CLI comparte la misma cadena de herramientas (edición de archivos, MCP, bash) y memoria del proyecto con el núcleo compartido.

---

## Modelos Soportados

### Grok (xAI)

| Modelo | Contexto | Características | Alias |
|--------|----------|-----------------|-------|
| `grok-4.1` | 131K | Predeterminado equilibrado con razonamiento, visión y búsqueda integrados | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Ideal para sesiones agénticas/intensivas en herramientas con razonamiento | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Ejecuciones agénticas más rápidas sin razonamiento extendido | `grok-fast-nr` |
| `grok-4-0709` | 131K | Versión original de Grok 4 (compatible) | `grok-4` |
| `grok-2-image-1212` | 32K | **Generación de imágenes**: Texto a imagen | `grok-image` |

> **Alias de Modelos**: Usa alias convenientes como `ax-grok -m grok-latest` en lugar de nombres completos de modelos.

---

## Instalación

### Requisitos

- Node.js 24.0.0+
- macOS 14+, Windows 11+ o Ubuntu 24.04+

### Comando de Instalación

```bash
npm install -g @defai.digital/ax-grok
```

### Configuración

```bash
ax-grok setup
```

El asistente de configuración te guiará a través de:
1. Cifrar y almacenar de forma segura tu clave API (usando cifrado AES-256-GCM)
2. Configurar tu modelo de IA predeterminado y otras preferencias
3. Validar tu configuración para asegurar que todo esté configurado correctamente

---

## Uso

### Modo Interactivo

```bash
ax-grok              # Inicia la sesión CLI interactiva
ax-grok --continue   # Reanudar conversación anterior
ax-grok -c           # Forma corta
```

### Modo Headless

```bash
ax-grok -p "analiza este código base"
ax-grok -p "corrige errores TypeScript" -d /ruta/al/proyecto
```

### Banderas de Comportamiento Agéntico

```bash
# Habilitar modo de razonamiento ReAct (ciclos Pensamiento → Acción → Observación)
ax-grok --react

# Habilitar verificación TypeScript después de fases de planificación
ax-grok --verify

# Deshabilitar auto-corrección en fallos
ax-grok --no-correction
```

Por defecto, la auto-corrección está ACTIVADA (el agente reintenta automáticamente en fallos con reflexión). ReAct y verificación están DESACTIVADOS por defecto pero pueden habilitarse para razonamiento más estructurado y verificaciones de calidad.

### Comandos Esenciales

| Comando | Descripción |
|---------|-------------|
| `/init` | Inicializar contexto del proyecto |
| `/help` | Mostrar todos los comandos |
| `/model` | Cambiar modelo de IA |
| `/lang` | Cambiar idioma de visualización (11 idiomas) |
| `/doctor` | Ejecutar diagnósticos |
| `/exit` | Salir de la CLI |

### Atajos de Teclado

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| `Ctrl+O` | Alternar verbosidad | Mostrar u ocultar logs detallados y procesos internos |
| `Ctrl+K` | Acciones rápidas | Abrir menú de acciones rápidas para comandos comunes |
| `Ctrl+B` | Modo segundo plano | Ejecutar tarea actual en segundo plano |
| `Shift+Tab` | Auto-edición | Activar sugerencias de código impulsadas por IA |
| `Esc` ×2 | Cancelar | Limpiar entrada actual o cancelar operación en curso |

---

## Configuración

### Archivos de Configuración

| Archivo | Propósito |
|---------|-----------|
| `~/.ax-grok/config.json` | Configuración del usuario (clave API cifrada) |
| `.ax-grok/settings.json` | Anulaciones del proyecto |
| `.ax-grok/CUSTOM.md` | Instrucciones personalizadas de IA |
| `ax.index.json` | Índice compartido del proyecto (en raíz, usado por todas las CLIs) |

### Variables de Entorno

```bash
# Para CI/CD
export XAI_API_KEY=your_key
```

---

## Integración MCP

Extiende capacidades con [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — un estándar abierto para conectar asistentes de IA con herramientas externas, APIs y fuentes de datos:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Plantillas Disponibles:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive y más.

---

## Extensión VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Panel de chat en barra lateral
- Vista previa de diferencias para cambios de archivos
- Comandos conscientes del contexto
- Sistema de checkpoints y retroceso

---

## Integración AutomatosX

AX CLI se integra con [AutomatosX](https://github.com/defai-digital/automatosx) - un sistema de IA multi-agente con corrección autónoma de bugs, refactorización inteligente y 20+ agentes especializados.

En modo interactivo (`ax-grok`), simplemente pregunta de forma natural:

```
> por favor escanea y corrige bugs en este código base

> refactoriza el módulo de autenticación, enfócate en eliminar código muerto

> usa el agente de seguridad para auditar los endpoints de la API
```

**Lo que obtienes:**
- **Corrección de bugs**: Detecta fugas de temporizadores, limpieza faltante, problemas de recursos - corrige automáticamente con seguridad de rollback
- **Refactorización**: Elimina código muerto, corrige seguridad de tipos, reduce complejidad - verificado por chequeo de tipos
- **20+ agentes**: Backend, frontend, seguridad, arquitectura, DevOps, datos y más

---

## Memoria del Proyecto

Reduce costos de tokens y mejora el recuerdo de contexto con caché inteligente que almacena y recupera información relevante del proyecto, evitando procesamiento redundante.

```bash
ax-grok memory warmup    # Generar caché de contexto
ax-grok memory status    # Ver distribución de tokens
```

---

## Seguridad

- **Cifrado de Clave API:** AES-256-GCM con PBKDF2 (600K iteraciones)
- **Sin Telemetría:** Cero recolección de datos
- **Protecciones CVSS:** Salvaguardas robustas contra vulnerabilidades comunes como Inyección de Comandos (CVSS 9.8), Path Traversal (CVSS 8.6) y SSRF (CVSS 7.5)

---

## Arquitectura

AX CLI usa una arquitectura modular con CLIs específicas por proveedor construidas sobre un núcleo compartido:

```
┌─────────────────────────────────────────────────────────────┐
│                   Instalación del Usuario                    │
├─────────────────────────────────────────────────────────────┤
│                  @defai.digital/ax-grok                     │
│                     (ax-grok CLI)                           │
│                                                             │
│  • Razonamiento extendido Grok 3                            │
│  • Valores por defecto xAI                                  │
│  • Búsqueda web en vivo                                     │
│  • Configuración ~/.ax-grok/                                │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Funcionalidad compartida: 17 herramientas, cliente MCP,    │
│  memoria, checkpoints, React/Ink UI, operaciones de archivo │
└─────────────────────────────────────────────────────────────┘
```

---

## Paquetes

| Paquete | ¿Instalar? | Descripción |
|---------|:----------:|-------------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Sí** | CLI optimizada para Grok con búsqueda web, visión, pensamiento extendido |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Opcional | CLI local-first para Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | No | Biblioteca núcleo compartida (instalada automáticamente como dependencia) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | No | Esquemas Zod compartidos (instalados automáticamente como dependencia) |

> **Nota:** ax-glm ha sido descontinuado en favor del [OpenCode CLI](https://opencode.ai) oficial de Z.AI.

---

## Licencia

Licencia MIT - ver [LICENSE](LICENSE)

---

<p align="center">
  Hecho con amor por <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
