# AX CLI - Vibe Coding de Clase Empresarial

> 📖 Esta traducción está basada en [README.md @ v5.2.0](./README.md)

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

## Tabla de Contenidos

- [Inicio Rápido](#inicio-rápido)
- [Usuarios de GLM](#usuarios-de-glm)
- [¿Por qué AX CLI?](#por-qué-ax-cli)
- [Modelos Compatibles](#modelos-compatibles)
- [Instalación](#instalación)
- [Uso](#uso)
- [Inicialización del Proyecto](#inicialización-del-proyecto)
- [Configuración](#configuración)
- [Integración MCP](#integración-mcp)
- [Extensión de VSCode](#extensión-de-vscode)
- [Integración con AutomatosX](#integración-con-automatosx)
- [Memoria del Proyecto](#memoria-del-proyecto)
- [Seguridad](#seguridad)
- [Arquitectura](#arquitectura)
- [Paquetes](#paquetes)
- [Changelog](#changelog)
- [Documentación](#documentación)
- [Enterprise](#enterprise)

---

## Inicio Rápido

Comienza en menos de un minuto:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Ideal para:** búsqueda web en vivo, visión, razonamiento extendido, ventana de contexto de 2M

Ejecuta `/init` dentro de la CLI para inicializar el contexto del proyecto.

---

## Usuarios de GLM

> **Nota:** El paquete en la nube `ax-glm` ha sido descontinuado.
>
> **Para acceso a la API de GLM en la nube, recomendamos usar [OpenCode](https://opencode.ai).**

**Modelos GLM locales** (GLM-4.6, CodeGeeX4) siguen siendo totalmente compatibles a través de `ax-cli` para inferencia offline con Ollama, LMStudio o vLLM. Consulta [Modelos locales/offline](#modelos-localesoffline-ax-cli) abajo.

---

## ¿Por qué AX CLI?

| Función | Descripción |
|---------|-------------|
| **Optimizado por proveedor** | Soporte de primera clase para Grok (xAI) con parámetros específicos del proveedor |
| **17 herramientas integradas** | Edición de archivos, ejecución de bash, búsqueda, tareas y más |
| **Comportamientos agenticos** | Bucles de razonamiento ReAct, autocorrección ante fallos, verificación TypeScript |
| **Agentes AutomatosX** | 20+ agentes especializados para backend, frontend, seguridad, DevOps y más |
| **Corrección automática de bugs** | Escanea y corrige fugas de temporizador, problemas de recursos, errores de tipos con seguridad de rollback |
| **Refactorización inteligente** | Elimina código muerto, corrige seguridad de tipos, reduce complejidad con verificación |
| **Integración MCP** | Model Context Protocol con 12+ plantillas listas para producción |
| **Memoria del proyecto** | Caché inteligente de contexto con 50% de ahorro de tokens |
| **Seguridad empresarial** | Cifrado AES-256-GCM, sin telemetría, protecciones con CVSS |
| **65% de cobertura de pruebas** | 6,205+ pruebas con TypeScript estricto |

---

### Destacados de Grok

- **Grok (ax-grok)**: búsqueda web integrada, visión, reasoning_effort; **las variantes rápidas de Grok 4.1 ofrecen 2M de contexto, herramientas de servidor en paralelo, x_search y ejecución de código en el servidor**. Consulta `docs/grok-4.1-advanced-features.md` para detalles.

---

## Modelos Compatibles

### Grok (xAI)

> **Grok 4.1 avanzado**: ax-grok habilita las herramientas agenticas del servidor de Grok 4.1 (web_search, x_search, code_execution) con function calling en paralelo y variantes rápidas de 2M de contexto. Consulta la guía completa en `docs/grok-4.1-advanced-features.md`.

| Modelo | Contexto | Funciones | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Equilibrado con razonamiento, visión, búsqueda integrados | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Ideal para sesiones agenticas/herramientas con razonamiento | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Máxima velocidad sin razonamiento extendido | `grok-fast-nr` |
| `grok-4-0709` | 131K | Lanzamiento original de Grok 4 (compatible) | `grok-4` |
| `grok-2-image-1212` | 32K | **Generación de imágenes**: texto a imagen | `grok-image` |

> **Aliases de modelos**: usa alias como `ax-grok -m grok-latest` en lugar de nombres completos.

### Modelos Locales/Offline (ax-cli)

Para inferencia local vía Ollama, LMStudio o vLLM, usa `ax-cli`:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Configura la URL de tu servidor local
```

ax-cli funciona con **cualquier modelo** disponible en tu servidor local. Solo especifica el tag del modelo al configurar (p. ej., `qwen3:14b`, `glm4:9b`).

**Familias de modelos recomendadas:**

| Modelo | Mejor para |
|-------|-----------|
| **Qwen** | Mejor en general para tareas de código |
| **GLM** | Refactorización y documentación |
| **DeepSeek** | Iteraciones rápidas, buen equilibrio velocidad/calidad |
| **Codestral** | C/C++/Rust y programación de sistemas |
| **Llama** | Mejor compatibilidad y fallback |

---

## Instalación

### Requisitos

- Node.js 24.0.0+
- macOS 14+, Windows 11+ o Ubuntu 24.04+

### Instalar

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Configuración

```bash
ax-grok setup
```

El asistente de configuración te guiará para:
1. Cifrar y almacenar tu clave API de forma segura (con cifrado AES-256-GCM).
2. Configurar tu modelo de IA predeterminado y otras preferencias.
3. Validar tu configuración para asegurarse de que todo esté correctamente configurado.

---

## Uso

### Modo interactivo

```bash
ax-grok              # Inicia la sesión interactiva del CLI
ax-grok --continue   # Reanuda la conversación previa
ax-grok -c           # Forma corta
```

### Modo headless

```bash
ax-grok -p "analiza esta base de código"
ax-grok -p "corrige errores de TypeScript" -d /ruta/al/proyecto
```

### Flags de comportamiento agentico

```bash
# Habilitar modo ReAct (Pensar → Acción → Observación)
ax-grok --react

# Habilitar verificación TypeScript después de fases de planificación
ax-grok --verify

# Desactivar autocorrección ante fallos
ax-grok --no-correction
```

Por defecto, la autocorrección está ACTIVADA (el agente reintenta automáticamente con reflexión). ReAct y verificación están DESACTIVADOS por defecto, pero pueden activarse para un razonamiento más estructurado y mejores comprobaciones de calidad.

### Comandos esenciales

| Comando | Descripción |
|---------|-------------|
| `/init` | Generar contexto de proyecto AX.md (ver [Inicialización del Proyecto](#inicialización-del-proyecto)) |
| `/help` | Mostrar todos los comandos |
| `/model` | Cambiar modelo de IA |
| `/lang` | Cambiar idioma de interfaz (11 idiomas) |
| `/doctor` | Ejecutar diagnósticos |
| `/exit` | Salir del CLI |

### Atajos de teclado

| Atajo | Acción | Descripción |
|-------|--------|-------------|
| `Ctrl+O` | Alternar verbosidad | Mostrar u ocultar logs detallados y procesos internos |
| `Ctrl+K` | Acciones rápidas | Abrir el menú de acciones rápidas |
| `Ctrl+B` | Modo en segundo plano | Ejecutar la tarea actual en segundo plano |
| `Shift+Tab` | Auto-edición | Activar sugerencias de código con IA |
| `Esc` ×2 | Cancelar | Limpiar la entrada o cancelar la operación |

---

## Inicialización del Proyecto

El comando `/init` genera un archivo `AX.md` en la raíz del proyecto, un archivo de contexto integral que ayuda a la IA a entender tu base de código.

### Uso básico

```bash
ax-grok
> /init                    # Análisis estándar (recomendado)
> /init --depth=basic      # Escaneo rápido para proyectos pequeños
> /init --depth=full       # Análisis profundo con mapeo de arquitectura
> /init --depth=security   # Incluye auditoría de seguridad (secrets, APIs peligrosas)
```

### Niveles de profundidad

| Profundidad | Qué se analiza | Ideal para |
|------------|-----------------|-----------|
| `basic` | Nombre, lenguaje, stack, scripts | Configuración rápida, proyectos pequeños |
| `standard` | + Estadísticas de código, análisis de tests, documentación | La mayoría de los proyectos (por defecto) |
| `full` | + Arquitectura, dependencias, hotspots, guías de uso | Codebases grandes |
| `security` | + Escaneo de secrets, detección de APIs peligrosas, patrones de auth | Proyectos sensibles a seguridad |

### Salida adaptativa

El comando `/init` ajusta automáticamente la verbosidad de salida según la complejidad del proyecto:

| Tamaño del proyecto | Archivos | Salida típica |
|---------------------|---------|---------------|
| Pequeño | <50 archivos | Concisa, solo lo esencial |
| Mediano | 50-200 archivos | Documentación estándar |
| Grande | 200-500 archivos | Detallada con notas de arquitectura |
| Enterprise | 500+ archivos | Completa con todas las secciones |

### Opciones

| Opción | Descripción |
|--------|-------------|
| `--depth=<level>` | Establecer profundidad de análisis (basic, standard, full, security) |
| `--refresh` | Actualizar AX.md existente con el último análisis |
| `--force` | Regenerar incluso si AX.md ya existe |

### Archivos generados

| Archivo | Propósito |
|--------|----------|
| `AX.md` | Archivo principal de contexto para IA (siempre generado) |
| `.ax/analysis.json` | Datos de análisis profundo (solo en full/security) |

### Cómo funciona la inyección de contexto

Cuando inicias una conversación, AX CLI lee automáticamente tu archivo `AX.md` y lo inyecta en la ventana de contexto de la IA. Esto significa:

1. **La IA conoce tu proyecto** - Comandos de build, stack, convenciones
2. **Sin explicaciones repetidas** - La IA recuerda la estructura del proyecto
3. **Mejores sugerencias de código** - Sigue tus patrones y reglas existentes

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

**Orden de prioridad** (si existen varios archivos de contexto):
1. `AX.md` (recomendado) - Nuevo formato de archivo único
2. `ax.summary.json` (legacy) - Resumen JSON
3. `ax.index.json` (legacy) - Índice JSON completo

### Migración desde formato legacy

Si tienes archivos legacy (`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`), ejecuta:

```bash
> /init --force
```

Esto genera el nuevo formato de archivo único `AX.md`. Luego puedes eliminar los archivos legacy.

---

## Configuración

### Archivos de configuración

| Archivo | Propósito |
|--------|-----------|
| `~/.ax-grok/config.json` | Ajustes de usuario (clave API cifrada) |
| `.ax-grok/settings.json` | Anulaciones del proyecto |
| `AX.md` | Archivo de contexto del proyecto (generado por `/init`) |

### Variables de entorno

```bash
# Para CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## Integración MCP

Extiende las capacidades con [Model Context Protocol (MCP)](https://modelcontextprotocol.io), un estándar abierto para conectar asistentes de IA con herramientas externas, APIs y fuentes de datos:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Plantillas disponibles:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive y más.

---

## Extensión de VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Panel de chat en la barra lateral
- Vista previa de diff para cambios de archivos
- Comandos con contexto
- Sistema de checkpoints y rebobinado

---

## Integración con AutomatosX

AX CLI se integra con [AutomatosX](https://github.com/defai-digital/automatosx), un sistema multiagente con corrección automática de bugs, refactorización inteligente y 20+ agentes especializados.

En modo interactivo (`ax-grok`), solo pregunta de forma natural:

```
> por favor escanea y corrige bugs en esta base de código

> refactoriza el módulo de autenticación, enfócate en eliminar código muerto

> usa el agente de seguridad para auditar los endpoints de la API

> revisa este PRD y trabaja con el agente de producto para mejorarlo

> pide a los agentes de backend y frontend que implementen juntos el registro de usuarios
```

**Lo que obtienes:**
- **Corrección de bugs**: Detecta fugas de temporizador, falta de limpieza, problemas de recursos - auto-corrección con seguridad de rollback
- **Refactorización**: Elimina código muerto, corrige seguridad de tipos, reduce complejidad - verificado por typecheck
- **20+ agentes**: Backend, frontend, seguridad, arquitectura, DevOps, datos y más

Consulta la [Guía de AutomatosX](docs/AutomatosX-Integration.md) para lista de agentes, opciones avanzadas y configuración

---

## Memoria del Proyecto

Reduce costos de tokens y mejora el recuerdo del contexto con caché inteligente que almacena y recupera información relevante del proyecto, evitando procesamiento redundante.

```bash
ax-grok memory warmup    # Generar caché de contexto
ax-grok memory status    # Ver distribución de tokens
```

---

## Seguridad

- **Cifrado de clave API:** AES-256-GCM con PBKDF2 (600K iteraciones)
- **Sin telemetría:** Cero recolección de datos
- **Protecciones CVSS:** Salvaguardas robustas contra vulnerabilidades comunes como Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) y SSRF (CVSS 7.5).

---

## Arquitectura

AX CLI usa una arquitectura modular con CLIs específicas por proveedor sobre un núcleo compartido:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 razonamiento extendido                           │
│  • xAI API defaults                                         │
│  • Búsqueda web en vivo                                     │
│  • ~/.ax-grok/ configuración                                │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Funcionalidad compartida: 17 herramientas, cliente MCP,    │
│  memoria, checkpoints, UI React/Ink, operaciones de archivo,│
│  soporte git                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Paquetes

| Paquete | ¿Instalar? | Descripción |
|---------|:----------:|-------------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Sí** | CLI optimizada para Grok con búsqueda web, visión, pensamiento extendido |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Opcional | CLI local-first para Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | No | Biblioteca central compartida (auto-instalada como dependencia) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | No | Esquemas Zod compartidos (auto-instalados como dependencia) |

> **Usuarios de GLM Cloud:** Para la API de GLM Cloud, recomendamos [OpenCode](https://opencode.ai).

---

## Changelog

| Versión | Highlights |
|---------|------------|
| **v5.2.0** | Feature: inyección de contexto AX.md - la IA ahora entiende tu proyecto automáticamente al iniciar |
| **v5.1.19** | Rendimiento: O(N×M) → O(N+M) en análisis de dependencias, expulsión de caché optimizada, fixes de UI |
| **v5.1.18** | Refactorización: constantes nombradas, nombres de variables unificados, 6,205 pruebas pasando |
| **v5.1.17** | Fix: bug de cancelación ESC, fugas de temporizador, manejo de timeouts MCP |

[Ver changelog completo en GitHub →](https://github.com/defai-digital/ax-cli/releases)

---

## Documentación

- [Funciones](docs/features.md)
- [Configuración](docs/configuration.md)
- [Referencia CLI](docs/cli-reference.md)
- [Integración MCP](docs/mcp.md)
- [Guía AutomatosX](docs/AutomatosX-Integration.md)
- [Guía VSCode](docs/vscode-integration-guide.md)
- [Integración Figma](docs/figma-guide.md)
- [Solución de problemas](docs/troubleshooting.md)

---

## Enterprise

Para equipos que requieren capacidades avanzadas:

- Reportes de cumplimiento (SOC2, HIPAA)
- Registro de auditoría avanzado
- Integración SSO/SAML
- Soporte prioritario (SLA 24 horas)

Contacto: **sales@defai.digital**

---

## Licencia

Licencia MIT - consulta [LICENSE](LICENSE)

---

<p align="center">
  Hecho con ❤️ por <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
