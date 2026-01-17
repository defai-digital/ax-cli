# AX CLI - Enterprise-Klasse Vibe Coding

> 📖 Diese Übersetzung basiert auf [README.md @ v5.2.0](./README.md)

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

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [GLM Benutzer](#glm-benutzer)
- [Warum AX CLI?](#warum-ax-cli)
- [Unterstützte Modelle](#unterstützte-modelle)
- [Installation](#installation)
- [Verwendung](#verwendung)
- [Projekt-Initialisierung](#projekt-initialisierung)
- [Konfiguration](#konfiguration)
- [MCP-Integration](#mcp-integration)
- [VSCode-Erweiterung](#vscode-erweiterung)
- [AutomatosX-Integration](#automatosx-integration)
- [Projekt-Speicher](#projekt-speicher)
- [Sicherheit](#sicherheit)
- [Architektur](#architektur)
- [Pakete](#pakete)
- [Changelog](#changelog)
- [Dokumentation](#dokumentation)
- [Enterprise](#enterprise)

---

## Schnellstart

Loslegen in unter einer Minute:

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Optimal für:** Live-Websuche, Vision, erweitertes Reasoning, 2M Kontextfenster

Führen Sie `/init` in der CLI aus, um Ihren Projektkontext zu initialisieren.

---

## GLM Benutzer

> **Hinweis:** Das `ax-glm` Cloud-Paket wurde als veraltet markiert.
>
> **Für GLM Cloud-API-Zugriff empfehlen wir [OpenCode](https://opencode.ai).**

**Lokale GLM-Modelle** (GLM-4.6, CodeGeeX4) werden weiterhin vollständig über `ax-cli` für Offline-Inferenz durch Ollama, LMStudio oder vLLM unterstützt. Siehe [Lokale/Offline-Modelle](#lokaleoffline-modelle-ax-cli) unten.

---

## Warum AX CLI?

| Funktion | Beschreibung |
|---------|--------------|
| **Anbieter-Optimiert** | Erstklassige Unterstützung für Grok (xAI) mit anbieterspezifischen Parametern |
| **17 Eingebaute Tools** | Dateibearbeitung, Bash-Ausführung, Suche, Todos und mehr |
| **Agentisches Verhalten** | ReAct-Reasoning-Schleifen, Selbstkorrektur bei Fehlern, TypeScript-Verifizierung |
| **AutomatosX-Agenten** | 20+ spezialisierte KI-Agenten für Backend, Frontend, Sicherheit, DevOps und mehr |
| **Autonome Fehlerbehebung** | Scannt und behebt automatisch Timer-Lecks, Ressourcenprobleme, Typfehler mit Rollback-Sicherheit |
| **Intelligentes Refactoring** | Entfernt toten Code, behebt Typensicherheit, reduziert Komplexität mit Verifizierung |
| **MCP-Integration** | Model Context Protocol mit 12+ produktionsbereiten Vorlagen |
| **Projekt-Speicher** | Intelligentes Kontext-Caching mit 50% Token-Einsparung |
| **Enterprise-Sicherheit** | AES-256-GCM-Verschlüsselung, keine Telemetrie, CVSS-bewertete Schutzmaßnahmen |
| **65% Testabdeckung** | 6,205+ Tests mit striktem TypeScript |

---

### Grok-Highlights

- **Grok (ax-grok)**: Eingebaute Websuche, Vision, reasoning_effort; **Grok 4.1 schnelle Varianten bieten 2M Kontext, parallele Server-Tools, x_search und serverseitige Code-Ausführung**. Siehe `docs/grok-4.1-advanced-features.md` für Details.

---

## Unterstützte Modelle

### Grok (xAI)

> **Grok 4.1 advanced**: ax-grok aktiviert die serverseitigen Agent-Tools von Grok 4.1 (web_search, x_search, code_execution) mit parallelem Function-Calling und 2M-Kontext-Fast-Varianten. Siehe die vollständige Anleitung in `docs/grok-4.1-advanced-features.md`.

| Modell | Kontext | Funktionen | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Ausgewogener Standard mit eingebautem Reasoning, Vision, Suche | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Optimal für agentische/tool-intensive Sitzungen mit Reasoning | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Schnellste agentische Läufe ohne erweitertes Reasoning | `grok-fast-nr` |
| `grok-4-0709` | 131K | Originale Grok 4-Version (kompatibel) | `grok-4` |
| `grok-2-image-1212` | 32K | **Bilderzeugung**: Text-zu-Bild | `grok-image` |

> **Modell-Aliase**: Verwenden Sie praktische Aliase wie `ax-grok -m grok-latest` anstelle vollständiger Modellnamen.

### Lokale/Offline-Modelle (ax-cli)

Für lokale Inferenz via Ollama, LMStudio oder vLLM verwenden Sie `ax-cli`:

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Konfigurieren Sie Ihre lokale Server-URL
```

ax-cli funktioniert mit **jedem Modell**, das auf Ihrem lokalen Server verfügbar ist. Geben Sie einfach den Modell-Tag bei der Konfiguration an (z. B. `qwen3:14b`, `glm4:9b`).

**Empfohlene Modelfamilien:**

| Modell | Optimal für |
|-------|-------------|
| **Qwen** | Insgesamt am besten für Coding-Aufgaben |
| **GLM** | Refactoring und Dokumentation |
| **DeepSeek** | Schnelle Iterationen, gutes Tempo/Qualität |
| **Codestral** | C/C++/Rust und Systemprogrammierung |
| **Llama** | Beste Kompatibilität und Fallback |

---

## Installation

### Voraussetzungen

- Node.js 24.0.0+
- macOS 14+, Windows 11+ oder Ubuntu 24.04+

### Installationsbefehl

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Einrichtung

```bash
ax-grok setup
```

Der Einrichtungsassistent führt Sie durch:
1. Sichere Verschlüsselung und Speicherung Ihres API-Schlüssels (mit AES-256-GCM-Verschlüsselung).
2. Konfiguration Ihres Standard-KI-Modells und anderer Einstellungen.
3. Validierung Ihrer Konfiguration, um sicherzustellen, dass alles korrekt eingerichtet ist.

---

## Verwendung

### Interaktiver Modus

```bash
ax-grok              # Startet die interaktive CLI-Sitzung
ax-grok --continue   # Vorherige Konversation fortsetzen
ax-grok -c           # Kurzform
```

### Headless-Modus

```bash
ax-grok -p "analysiere diese Codebasis"
ax-grok -p "behebe TypeScript-Fehler" -d /pfad/zum/projekt
```

### Agentisches Verhalten-Flags

```bash
# ReAct-Reasoning-Modus aktivieren (Denken → Handeln → Beobachten-Zyklen)
ax-grok --react

# TypeScript-Verifizierung nach Planungsphasen aktivieren
ax-grok --verify

# Selbstkorrektur bei Fehlern deaktivieren
ax-grok --no-correction
```

Standardmäßig ist die Selbstkorrektur AN (Agent versucht automatisch bei Fehlern mit Reflexion erneut). ReAct und Verifizierung sind standardmäßig AUS, können aber für strukturierteres Reasoning und Qualitätsprüfungen aktiviert werden.

### Wesentliche Befehle

| Befehl | Beschreibung |
|---------|-------------|
| `/init` | AX.md Projektkontext generieren (siehe [Projekt-Initialisierung](#projekt-initialisierung)) |
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

## Projekt-Initialisierung

Der Befehl `/init` erstellt eine `AX.md` Datei im Projektstamm - eine umfassende Kontextdatei, die der KI hilft, Ihre Codebasis zu verstehen.

### Grundlegende Verwendung

```bash
ax-grok
> /init                    # Standard-Analyse (empfohlen)
> /init --depth=basic      # Schneller Scan für kleine Projekte
> /init --depth=full       # Tiefe Analyse mit Architektur-Mapping
> /init --depth=security   # Sicherheitsanalyse (Secrets, gefährliche APIs)
```

### Tiefenstufen

| Tiefe | Was analysiert wird | Optimal für |
|-------|---------------------|-----------|
| `basic` | Name, Sprache, Tech-Stack, Scripts | Schnellstart, kleine Projekte |
| `standard` | + Code-Statistiken, Testanalyse, Dokumentation | Die meisten Projekte (Standard) |
| `full` | + Architektur, Abhängigkeiten, Hotspots, How-to-Guides | Große Codebasen |
| `security` | + Secret-Scanning, gefährliche API-Erkennung, Auth-Patterns | Sicherheitskritische Projekte |

### Adaptive Ausgabe

Der Befehl `/init` passt die Ausgabedetailtiefe automatisch an die Komplexität Ihres Projekts an:

| Projektgröße | Dateien | Typische Ausgabe |
|-------------|---------|-----------------|
| Klein | <50 Dateien | Kurz und nur das Wesentliche |
| Mittel | 50-200 Dateien | Standard-Dokumentation |
| Groß | 200-500 Dateien | Detailliert mit Architekturhinweisen |
| Enterprise | 500+ Dateien | Umfassend mit allen Abschnitten |

### Optionen

| Option | Beschreibung |
|--------|-------------|
| `--depth=<level>` | Analysetiefe festlegen (basic, standard, full, security) |
| `--refresh` | Bestehende AX.md mit aktueller Analyse aktualisieren |
| `--force` | Neu generieren, auch wenn AX.md existiert |

### Generierte Dateien

| Datei | Zweck |
|------|------|
| `AX.md` | Primäre KI-Kontextdatei (immer generiert) |
| `.ax/analysis.json` | Tiefenanalyse-Daten (nur full/security) |

### Wie die Kontext-Injection funktioniert

Wenn Sie eine Konversation starten, liest AX CLI automatisch Ihre `AX.md` Datei und injiziert sie in das Kontextfenster der KI. Das bedeutet:

1. **Die KI kennt Ihr Projekt** - Build-Kommandos, Tech-Stack, Konventionen
2. **Keine wiederholten Erklärungen** - Die KI merkt sich Ihre Projektstruktur
3. **Bessere Codevorschläge** - Folgt Ihren bestehenden Patterns und Regeln

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

**Prioritätsreihenfolge** (falls mehrere Kontextdateien existieren):
1. `AX.md` (empfohlen) - Neues Ein-Datei-Format
2. `ax.summary.json` (legacy) - JSON-Zusammenfassung
3. `ax.index.json` (legacy) - Vollständiger JSON-Index

### Migration vom Legacy-Format

Wenn Sie Legacy-Dateien (`.ax-grok/CUSTOM.md`, `ax.index.json`, `ax.summary.json`) haben, führen Sie aus:

```bash
> /init --force
```

Dies erzeugt das neue Ein-Datei-Format `AX.md`. Legacy-Dateien können anschließend entfernt werden.

---

## Konfiguration

### Konfigurationsdateien

| Datei | Zweck |
|-------|-------|
| `~/.ax-grok/config.json` | Benutzereinstellungen (verschlüsselter API-Schlüssel) |
| `.ax-grok/settings.json` | Projekt-Überschreibungen |
| `AX.md` | Projekt-Kontextdatei (durch `/init` generiert) |

### Umgebungsvariablen

```bash
# Für CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## MCP-Integration

Erweitern Sie die Funktionen mit [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — einem offenen Standard zur Verbindung von KI-Assistenten mit externen Tools, APIs und Datenquellen:

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
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

Im interaktiven Modus (`ax-grok`) einfach natürlich fragen:

```
> Bitte scanne und behebe Bugs in dieser Codebasis

> Refaktoriere das Authentifizierungsmodul, konzentriere dich auf die Entfernung von totem Code

> Verwende den Sicherheitsagenten, um die API-Endpunkte zu prüfen

> Prüfe dieses PRD und arbeite mit dem Produktagenten, um es zu verbessern

> Bitte die Backend- und Frontend-Agenten, gemeinsam die Benutzerregistrierung zu implementieren
```

**Was Sie erhalten:**
- **Fehlerbehebung**: Erkennt Timer-Lecks, fehlende Bereinigung, Ressourcenprobleme - automatische Behebung mit Rollback-Sicherheit
- **Refactoring**: Entfernt toten Code, behebt Typensicherheit, reduziert Komplexität - verifiziert durch Typprüfung
- **20+ Agenten**: Backend, Frontend, Sicherheit, Architektur, DevOps, Daten und mehr

Siehe [AutomatosX Guide](docs/AutomatosX-Integration.md) für Agentenliste, erweiterte Optionen und Konfiguration

---

## Projekt-Speicher

Reduzieren Sie Token-Kosten und verbessern Sie den Kontextabruf mit intelligentem Caching, das relevante Projektinformationen speichert und abruft und redundante Verarbeitung vermeidet.

```bash
ax-grok memory warmup    # Kontext-Cache generieren
ax-grok memory status    # Token-Verteilung anzeigen
```

---

## Sicherheit

- **API-Schlüssel-Verschlüsselung:** AES-256-GCM mit PBKDF2 (600K Iterationen)
- **Keine Telemetrie:** Keine Datensammlung
- **CVSS-Schutzmaßnahmen:** Robuste Sicherheitsvorkehrungen gegen häufige Schwachstellen wie Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) und SSRF (CVSS 7.5).

---

## Architektur

AX CLI verwendet eine modulare Architektur mit anbieterspezifischen CLIs, die auf einem gemeinsamen Kern aufbauen:

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 erweitertes Reasoning                            │
│  • xAI API-Defaults                                         │
│  • Live-Websuche                                            │
│  • ~/.ax-grok/ Konfiguration                                │
├─────────────────────────────────────────────────────────────┤
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
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Ja** | Grok-optimierte CLI mit Websuche, Vision, erweitertem Denken |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Optional | Local-First CLI für Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Nein | Gemeinsame Kernbibliothek (automatisch als Abhängigkeit installiert) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Nein | Gemeinsame Zod-Schemas (automatisch als Abhängigkeit installiert) |

> **GLM Cloud-Benutzer:** Für die GLM Cloud-API empfehlen wir [OpenCode](https://opencode.ai).

---

## Changelog

| Version | Highlights |
|---------|------------|
| **v5.2.0** | Feature: AX.md Kontext-Injection - die KI versteht Ihr Projekt nun automatisch beim Start |
| **v5.1.19** | Performance: O(N×M) → O(N+M) Abhängigkeitsanalyse, optimierte Cache-Eviction, UI-Bugfixes |
| **v5.1.18** | Refactoring: Benannte Konstanten, einheitliche Variablennamen, 6.205 Tests erfolgreich |
| **v5.1.17** | Fix: ESC-Abbruch-Bug, Timer-Lecks, MCP-Timeout-Handling |

[Volles Changelog auf GitHub ansehen →](https://github.com/defai-digital/ax-cli/releases)

---

## Dokumentation

- [Features](docs/features.md)
- [Konfiguration](docs/configuration.md)
- [CLI-Referenz](docs/cli-reference.md)
- [MCP-Integration](docs/mcp.md)
- [AutomatosX Guide](docs/AutomatosX-Integration.md)
- [VSCode Guide](docs/vscode-integration-guide.md)
- [Figma-Integration](docs/figma-guide.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Enterprise

Für Teams mit erweiterten Anforderungen:

- Compliance-Berichte (SOC2, HIPAA)
- Erweiterte Audit-Logs
- SSO/SAML-Integration
- Priority Support (24-Stunden-SLA)

Kontakt: **sales@defai.digital**

---

## Lizenz

MIT-Lizenz - siehe [LICENSE](LICENSE)

---

<p align="center">
  Mit ❤️ erstellt von <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
