# AX CLI - Enterprise-Klasse KI-Codierung

> 📖 Diese Übersetzung basiert auf [README.md @ v5.1.8](./README.md)

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

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Warum AX CLI?](#warum-ax-cli)
- [Unterstützte Modelle](#unterstützte-modelle)
- [Installation](#installation)
- [Verwendung](#verwendung)
- [Konfiguration](#konfiguration)
- [MCP-Integration](#mcp-integration)
- [VSCode-Erweiterung](#vscode-erweiterung)
- [AutomatosX-Integration](#automatosx-integration)
- [Projekt-Speicher](#projekt-speicher)
- [Sicherheit](#sicherheit)
- [Architektur](#architektur)
- [Pakete](#pakete)

---

<p align="center">
  <img src=".github/assets/glm.png" alt="AX-GLM" width="400"/>
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Enterprise-Grade KI-Codierungsassistent, optimiert für GLM und Grok</strong>
</p>

## Schnellstart

Starten Sie in unter einer Minute. Wählen Sie Ihren KI-Anbieter und installieren Sie die dedizierte CLI:

<table>
<tr>
<td width="50%">

### GLM (Z.AI)

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

**Optimal für:** 200K Kontext, Denkmodus, chinesische Sprachunterstützung

</td>
<td width="50%">

### Grok (xAI)

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Optimal für:** Live-Websuche, Vision, erweitertes Reasoning

</td>
</tr>
</table>

Führen Sie `/init` in der CLI aus, um Ihren Projektkontext zu initialisieren.

> **Welche CLI sollte ich installieren?** Installieren Sie `ax-glm`, wenn Sie einen Z.AI API-Schlüssel haben, oder `ax-grok`, wenn Sie einen xAI API-Schlüssel haben. Beide bieten denselben voll ausgestatteten Codierungsassistenten, optimiert für ihren jeweiligen Anbieter.

---

## Warum AX CLI?

| Funktion | Beschreibung |
|----------|--------------|
| **Anbieter-Optimiert** | Erstklassige Unterstützung für GLM (Z.AI) und Grok (xAI) mit anbieterspezifischen Parametern |
| **17 Eingebaute Tools** | Dateibearbeitung, Bash-Ausführung, Suche, Todos und mehr |
| **Agentisches Verhalten** | ReAct-Reasoning-Schleifen, Selbstkorrektur bei Fehlern, TypeScript-Verifizierung |
| **AutomatosX-Agenten** | 20+ spezialisierte KI-Agenten für Backend, Frontend, Sicherheit, DevOps und mehr |
| **Autonome Fehlerbehebung** | Scannt und behebt automatisch Timer-Lecks, Ressourcenprobleme, Typfehler mit Rollback-Sicherheit |
| **Intelligentes Refactoring** | Entfernung von totem Code, Typensicherheitskorrekturen, Komplexitätsreduzierung mit Verifizierung |
| **MCP-Integration** | Model Context Protocol mit 12+ produktionsbereiten Vorlagen |
| **Projekt-Speicher** | Intelligentes Kontext-Caching mit 50% Token-Einsparung |
| **Enterprise-Sicherheit** | AES-256-GCM-Verschlüsselung, keine Telemetrie, CVSS-bewertete Schutzmaßnahmen |
| **65% Testabdeckung** | 6.084+ Tests mit striktem TypeScript |

---

### Anbieter-Highlights (GLM + Grok)

- **GLM (ax-glm)**: 200K Kontext, **GLM 4.7** mit verbessertem Reasoning und Codierung, thinking_mode-Unterstützung, starke chinesische Sprachleistung, Vision über `glm-4.6v`, schnelle Iterationen über `glm-4-flash`.
- **Grok (ax-grok)**: Eingebaute Websuche, Vision, reasoning_effort; **Grok 4.1 schnelle Varianten bieten 2M Kontext, parallele Server-Tools, x_search und serverseitige Code-Ausführung**.
- Beide CLIs teilen dieselbe Toolchain (Dateibearbeitung, MCP, Bash) und Projektspeicher; wählen Sie den Anbieter, der zu Ihrem API-Schlüssel passt.
- Installieren Sie beide, um parallel mit isoliertem Zustand (`.ax-glm`, `.ax-grok`) für Seite-an-Seite-Vergleiche zu arbeiten.

---

## Unterstützte Modelle

### GLM (Z.AI)

| Modell | Kontext | Funktionen | Alias |
|--------|---------|------------|-------|
| `glm-4.7` | 200K | **Neuestes Modell**: Verbessertes Reasoning, verbesserte Codierung, beste Gesamtleistung | `glm-latest` |
| `glm-4.6` | 200K | **Denkmodus**: Detaillierte Denkprozesse und Planung | `glm-thinking` |
| `glm-4.6v` | 128K | **Vision + Denken**: Neuestes Vision-Modell mit nativem multimodalem Funktionsaufruf | `glm-vision` |
| `glm-4-flash` | 128K | Schnell, effizient für schnelle Aufgaben | `glm-fast` |
| `cogview-4` | - | **Bilderzeugung**: Text-zu-Bild mit variablen Auflösungen | `glm-image` |

### Grok (xAI)

| Modell | Kontext | Funktionen | Alias |
|--------|---------|------------|-------|
| `grok-4.1` | 131K | Ausgewogener Standard mit eingebautem Reasoning, Vision, Suche | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Optimal für agentische/tool-intensive Sitzungen mit Reasoning | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Schnellste agentische Läufe ohne erweitertes Reasoning | `grok-fast-nr` |
| `grok-4-0709` | 131K | Originale Grok 4-Version (kompatibel) | `grok-4` |
| `grok-2-image-1212` | 32K | **Bilderzeugung**: Text-zu-Bild | `grok-image` |

> **Modell-Aliase**: Verwenden Sie praktische Aliase wie `ax-grok -m grok-latest` anstelle vollständiger Modellnamen.

---

## Installation

### Voraussetzungen

- Node.js 24.0.0+
- macOS 14+, Windows 11+ oder Ubuntu 24.04+

### Installationsbefehl

```bash
# Wählen Sie Ihren Anbieter
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Einrichtung

```bash
ax-glm setup   # oder ax-grok setup
```

Der Einrichtungsassistent führt Sie durch:
1. Sichere Verschlüsselung und Speicherung Ihres API-Schlüssels (mit AES-256-GCM-Verschlüsselung)
2. Konfiguration Ihres Standard-KI-Modells und anderer Einstellungen
3. Validierung Ihrer Konfiguration, um sicherzustellen, dass alles korrekt eingerichtet ist

---

## Verwendung

### Interaktiver Modus

```bash
ax-glm              # Startet die interaktive CLI-Sitzung
ax-glm --continue   # Vorherige Konversation fortsetzen
ax-glm -c           # Kurzform
```

### Headless-Modus

```bash
ax-glm -p "analysiere diese Codebasis"
ax-glm -p "behebe TypeScript-Fehler" -d /pfad/zum/projekt
```

### Agentisches Verhalten-Flags

```bash
# ReAct-Reasoning-Modus aktivieren (Denken → Handeln → Beobachten-Zyklen)
ax-glm --react

# TypeScript-Verifizierung nach Planungsphasen aktivieren
ax-glm --verify

# Selbstkorrektur bei Fehlern deaktivieren
ax-glm --no-correction
```

Standardmäßig ist die Selbstkorrektur AN (Agent versucht automatisch bei Fehlern mit Reflexion erneut). ReAct und Verifizierung sind standardmäßig AUS, können aber für strukturierteres Reasoning und Qualitätsprüfungen aktiviert werden.

### Wesentliche Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `/init` | Projektkontext initialisieren |
| `/help` | Alle Befehle anzeigen |
| `/model` | KI-Modell wechseln |
| `/lang` | Anzeigesprache ändern (11 Sprachen) |
| `/doctor` | Diagnose ausführen |
| `/exit` | CLI beenden |

### Tastenkombinationen

| Kürzel | Aktion | Beschreibung |
|--------|--------|--------------|
| `Ctrl+O` | Ausführlichkeit umschalten | Detaillierte Logs und interne Prozesse anzeigen/ausblenden |
| `Ctrl+K` | Schnellaktionen | Schnellaktionsmenü für häufige Befehle öffnen |
| `Ctrl+B` | Hintergrundmodus | Aktuelle Aufgabe im Hintergrund ausführen |
| `Shift+Tab` | Auto-Bearbeitung | KI-gestützte Code-Vorschläge auslösen |
| `Esc` ×2 | Abbrechen | Aktuelle Eingabe löschen oder laufende Operation abbrechen |

---

## Konfiguration

### Konfigurationsdateien

| Datei | Zweck |
|-------|-------|
| `~/.ax-glm/config.json` | Benutzereinstellungen (verschlüsselter API-Schlüssel) |
| `.ax-glm/settings.json` | Projekt-Überschreibungen |
| `.ax-glm/CUSTOM.md` | Benutzerdefinierte KI-Anweisungen |
| `ax.index.json` | Gemeinsamer Projektindex (im Stammverzeichnis, von allen CLIs verwendet) |

> Grok verwendet `~/.ax-grok/` und `.ax-grok/` Verzeichnisse. Die `ax.index.json` wird geteilt.

### Umgebungsvariablen

```bash
# Für CI/CD
export ZAI_API_KEY=your_key    # GLM
export XAI_API_KEY=your_key    # Grok
```

---

## MCP-Integration

Erweitern Sie die Funktionen mit [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — einem offenen Standard zur Verbindung von KI-Assistenten mit externen Tools, APIs und Datenquellen:

```bash
ax-glm mcp add figma --template
ax-glm mcp add github --template
ax-glm mcp list
```

**Verfügbare Vorlagen:** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive und mehr.

---

## VSCode-Erweiterung

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Seitenleisten-Chat-Panel
- Diff-Vorschau für Dateiänderungen
- Kontextbewusste Befehle
- Checkpoint- & Zurückspul-System

---

## AutomatosX-Integration

AX CLI integriert sich mit [AutomatosX](https://github.com/defai-digital/automatosx) - einem Multi-Agenten-KI-System mit autonomer Fehlerbehebung, intelligentem Refactoring und 20+ spezialisierten Agenten.

Im interaktiven Modus (`ax-glm` oder `ax-grok`) einfach natürlich fragen:

```
> Bitte scanne und behebe Bugs in dieser Codebasis

> Refaktoriere das Authentifizierungsmodul, konzentriere dich auf die Entfernung von totem Code

> Verwende den Sicherheitsagenten, um die API-Endpunkte zu prüfen
```

**Was Sie erhalten:**
- **Fehlerbehebung**: Erkennt Timer-Lecks, fehlende Bereinigung, Ressourcenprobleme - automatische Behebung mit Rollback-Sicherheit
- **Refactoring**: Entfernt toten Code, behebt Typensicherheit, reduziert Komplexität - verifiziert durch Typprüfung
- **20+ Agenten**: Backend, Frontend, Sicherheit, Architektur, DevOps, Daten und mehr

---

## Projekt-Speicher

Reduzieren Sie Token-Kosten und verbessern Sie den Kontextabruf mit intelligentem Caching, das relevante Projektinformationen speichert und abruft und redundante Verarbeitung vermeidet.

```bash
ax-glm memory warmup    # Kontext-Cache generieren
ax-glm memory status    # Token-Verteilung anzeigen
```

---

## Sicherheit

- **API-Schlüssel-Verschlüsselung:** AES-256-GCM mit PBKDF2 (600K Iterationen)
- **Keine Telemetrie:** Keine Datensammlung
- **CVSS-Schutzmaßnahmen:** Robuste Sicherheitsvorkehrungen gegen häufige Schwachstellen wie Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) und SSRF (CVSS 7.5)

---

## Architektur

AX CLI verwendet eine modulare Architektur mit anbieterspezifischen CLIs, die auf einem gemeinsamen Kern aufbauen:

```
┌─────────────────────────────────────────────────────────────┐
│                   Benutzer-Installation                      │
├─────────────────────────────┬───────────────────────────────┤
│      @defai.digital/ax-glm  │    @defai.digital/ax-grok     │
│         (ax-glm CLI)        │       (ax-grok CLI)           │
│                             │                               │
│  • GLM-4.6 Denkmodus        │  • Grok 3 erweitertes Reason. │
│  • Z.AI API-Defaults        │  • xAI API-Defaults           │
│  • 200K Kontextfenster      │  • Live-Websuche              │
│  • ~/.ax-glm/ Konfiguration │  • ~/.ax-grok/ Konfiguration  │
├─────────────────────────────┴───────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Gemeinsame Funktionalität: 17 Tools, MCP-Client, Speicher, │
│  Checkpoints, React/Ink UI, Dateioperationen, Git-Support   │
└─────────────────────────────────────────────────────────────┘
```

---

## Pakete

| Paket | Installieren? | Beschreibung |
|-------|:-------------:|--------------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | **Ja** | GLM-optimierte CLI mit Websuche, Vision, Bilderzeugung |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Ja** | Grok-optimierte CLI mit Websuche, Vision, erweitertem Denken |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Optional | Local-First CLI für Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Nein | Gemeinsame Kernbibliothek (automatisch als Abhängigkeit installiert) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Nein | Gemeinsame Zod-Schemas (automatisch als Abhängigkeit installiert) |

---

## Lizenz

MIT-Lizenz - siehe [LICENSE](LICENSE)

---

<p align="center">
  Mit Liebe erstellt von <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
