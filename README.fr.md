# AX CLI - Vibe Coding de Classe Entreprise

> 📖 Cette traduction est basée sur [README.md @ v5.1.19](./README.md)

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

## Table des Matières

- [Démarrage rapide](#démarrage-rapide)
- [Utilisateurs GLM](#utilisateurs-glm)
- [Pourquoi AX CLI ?](#pourquoi-ax-cli)
- [Modèles pris en charge](#modèles-pris-en-charge)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Intégration MCP](#intégration-mcp)
- [Extension VSCode](#extension-vscode)
- [Intégration AutomatosX](#intégration-automatosx)
- [Mémoire du projet](#mémoire-du-projet)
- [Sécurité](#sécurité)
- [Architecture](#architecture)
- [Packages](#packages)
- [Changelog](#changelog)
- [Documentation](#documentation)
- [Enterprise](#enterprise)

---

## Démarrage rapide

Commencez en moins d'une minute :

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Idéal pour :** recherche web en direct, vision, raisonnement étendu, fenêtre de contexte 2M

Exécutez `/init` dans le CLI pour initialiser le contexte de votre projet.

---

## Utilisateurs GLM

> **Note :** le package cloud `ax-glm` est obsolète.
>
> **Pour l'accès à l'API GLM cloud, nous recommandons d'utiliser [OpenCode](https://opencode.ai).**

**Les modèles GLM locaux** (GLM-4.6, CodeGeeX4) restent entièrement pris en charge via `ax-cli` pour l'inférence hors ligne avec Ollama, LMStudio ou vLLM. Voir [Modèles locaux/hors ligne](#modèles-locauxhors-ligne-ax-cli) ci-dessous.

---

## Pourquoi AX CLI ?

| Fonction | Description |
|---------|-------------|
| **Optimisé par fournisseur** | Support de première classe pour Grok (xAI) avec paramètres spécifiques au fournisseur |
| **17 outils intégrés** | Édition de fichiers, exécution bash, recherche, todos, etc. |
| **Comportements agentiques** | Boucles ReAct, autocorrection en cas d'échec, vérification TypeScript |
| **Agents AutomatosX** | 20+ agents spécialisés pour backend, frontend, sécurité, DevOps, etc. |
| **Correction autonome de bugs** | Détecte et corrige fuites de timer, problèmes de ressources, erreurs de types avec rollback sécurisé |
| **Refactorisation intelligente** | Suppression du code mort, correction de typage, réduction de complexité avec vérification |
| **Intégration MCP** | Model Context Protocol avec 12+ templates prêts pour la production |
| **Mémoire du projet** | Cache de contexte intelligent avec 50 % d'économies de tokens |
| **Sécurité entreprise** | Chiffrement AES-256-GCM, pas de télémétrie, protections CVSS |
| **65 % de couverture de tests** | 6,205+ tests avec TypeScript strict |

---

### Points forts de Grok

- **Grok (ax-grok)** : recherche web intégrée, vision, reasoning_effort ; **les variantes rapides de Grok 4.1 offrent 2M de contexte, des outils serveur parallèles, x_search et exécution de code côté serveur**. Voir `docs/grok-4.1-advanced-features.md` pour les détails.

---

## Modèles pris en charge

### Grok (xAI)

> **Grok 4.1 advanced** : ax-grok active les outils agentiques côté serveur de Grok 4.1 (web_search, x_search, code_execution) avec appel de fonctions en parallèle et variantes rapides en contexte 2M. Consultez le guide complet dans `docs/grok-4.1-advanced-features.md`.

| Modèle | Contexte | Fonctions | Alias |
|-------|---------|----------|-------|
| `grok-4.1` | 131K | Équilibré par défaut avec raisonnement, vision, recherche intégrés | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Idéal pour sessions agentiques/outils avec raisonnement | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Le plus rapide sans raisonnement étendu | `grok-fast-nr` |
| `grok-4-0709` | 131K | Sortie originale de Grok 4 (compatible) | `grok-4` |
| `grok-2-image-1212` | 32K | **Génération d'images** : texte vers image | `grok-image` |

> **Aliases de modèles** : utilisez des aliases comme `ax-grok -m grok-latest` au lieu des noms complets.

### Modèles locaux/hors ligne (ax-cli)

Pour l'inférence locale via Ollama, LMStudio ou vLLM, utilisez `ax-cli` :

```bash
npm install -g @defai.digital/ax-cli
ax-cli setup   # Configurez l'URL de votre serveur local
```

ax-cli fonctionne avec **n'importe quel modèle** disponible sur votre serveur local. Indiquez simplement le tag du modèle lors de la configuration (ex. `qwen3:14b`, `glm4:9b`).

**Familles de modèles recommandées :**

| Modèle | Idéal pour |
|-------|-----------|
| **Qwen** | Meilleur choix global pour le code |
| **GLM** | Refactorisation et documentation |
| **DeepSeek** | Itérations rapides, bon rapport vitesse/qualité |
| **Codestral** | C/C++/Rust et programmation système |
| **Llama** | Meilleure compatibilité et fallback |

---

## Installation

### Prérequis

- Node.js 24.0.0+
- macOS 14+, Windows 11+ ou Ubuntu 24.04+

### Installer

```bash
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Configuration

```bash
ax-grok setup
```

L'assistant de configuration vous guidera pour :
1. Chiffrer et stocker votre clé API en toute sécurité (chiffrement AES-256-GCM).
2. Configurer votre modèle IA par défaut et d'autres préférences.
3. Valider votre configuration pour s'assurer que tout est correctement configuré.

---

## Utilisation

### Mode interactif

```bash
ax-grok              # Démarre la session CLI interactive
ax-grok --continue   # Reprendre la conversation précédente
ax-grok -c           # Forme courte
```

### Mode headless

```bash
ax-grok -p "analyse cette base de code"
ax-grok -p "corrige les erreurs TypeScript" -d /chemin/du/projet
```

### Flags de comportement agentique

```bash
# Activer le mode ReAct (Pensée → Action → Observation)
ax-grok --react

# Activer la vérification TypeScript après les phases de planification
ax-grok --verify

# Désactiver l'autocorrection en cas d'échec
ax-grok --no-correction
```

Par défaut, l'autocorrection est ACTIVÉE (l'agent réessaie automatiquement avec réflexion). ReAct et la vérification sont DÉSACTIVÉS par défaut mais peuvent être activés pour un raisonnement plus structuré et des contrôles qualité.

### Commandes essentielles

| Commande | Description |
|---------|-------------|
| `/init` | Initialiser le contexte du projet |
| `/help` | Afficher toutes les commandes |
| `/model` | Changer le modèle IA |
| `/lang` | Changer la langue (11 langues) |
| `/doctor` | Lancer les diagnostics |
| `/exit` | Quitter le CLI |

### Raccourcis clavier

| Raccourci | Action | Description |
|----------|--------|-------------|
| `Ctrl+O` | Basculer la verbosité | Afficher/masquer les logs détaillés et processus internes |
| `Ctrl+K` | Actions rapides | Ouvrir le menu d'actions rapides |
| `Ctrl+B` | Mode arrière-plan | Exécuter la tâche en arrière-plan |
| `Shift+Tab` | Auto-édition | Déclencher des suggestions de code IA |
| `Esc` ×2 | Annuler | Effacer l'entrée ou annuler l'opération en cours |

---

## Configuration

### Fichiers de configuration

| Fichier | Rôle |
|--------|------|
| `~/.ax-grok/config.json` | Paramètres utilisateur (clé API chiffrée) |
| `.ax-grok/settings.json` | Overrides projet |
| `.ax-grok/CUSTOM.md` | Instructions IA personnalisées |
| `ax.index.json` | Index partagé du projet (à la racine) |

### Variables d'environnement

```bash
# Pour CI/CD
export XAI_API_KEY=your_key    # Grok
```

---

## Intégration MCP

Étendez les capacités avec [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — un standard ouvert pour connecter les assistants IA aux outils externes, API et sources de données :

```bash
ax-grok mcp add figma --template
ax-grok mcp add github --template
ax-grok mcp list
```

**Templates disponibles :** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive, etc.

---

## Extension VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Panneau de chat dans la barre latérale
- Aperçu diff des modifications de fichiers
- Commandes contextuelles
- Système de checkpoints et rewind

---

## Intégration AutomatosX

AX CLI s'intègre à [AutomatosX](https://github.com/defai-digital/automatosx), un système multi-agents avec correction autonome de bugs, refactorisation intelligente et 20+ agents spécialisés.

En mode interactif (`ax-grok`), posez simplement vos demandes :

```
> merci de scanner et corriger les bugs dans ce codebase

> refactorise le module d'authentification en supprimant le code mort

> utilise l'agent sécurité pour auditer les endpoints API

> révise ce PRD et travaille avec l'agent produit pour l'améliorer

> demande aux agents backend et frontend d'implémenter ensemble l'inscription utilisateur
```

**Ce que vous obtenez :**
- **Correction de bugs** : Détecte fuites de timer, nettoyages manquants, problèmes de ressources - auto-fix avec rollback sécurisé
- **Refactorisation** : Supprime le code mort, corrige la sécurité de typage, réduit la complexité - vérifié par typecheck
- **20+ agents** : Backend, frontend, sécurité, architecture, DevOps, data, etc.

Voir le [Guide AutomatosX](docs/AutomatosX-Integration.md) pour la liste des agents, options avancées et configuration

---

## Mémoire du projet

Réduisez les coûts de tokens et améliorez le rappel de contexte avec un cache intelligent qui stocke et récupère les informations pertinentes du projet, évitant le traitement redondant.

```bash
ax-grok memory warmup    # Générer le cache de contexte
ax-grok memory status    # Voir la distribution des tokens
```

---

## Sécurité

- **Chiffrement de clé API :** AES-256-GCM avec PBKDF2 (600K itérations)
- **Pas de télémétrie :** Aucune collecte de données
- **Protections CVSS :** Mesures robustes contre des vulnérabilités courantes comme Command Injection (CVSS 9.8), Path Traversal (CVSS 8.6) et SSRF (CVSS 7.5).

---

## Architecture

AX CLI utilise une architecture modulaire avec des CLIs spécifiques par fournisseur sur un noyau partagé :

```
┌─────────────────────────────────────────────────────────────┐
│                      User Installs                          │
├─────────────────────────────────────────────────────────────┤
│                 @defai.digital/ax-grok                      │
│                    (ax-grok CLI)                            │
│                                                             │
│  • Grok 4.1 raisonnement étendu                              │
│  • xAI API defaults                                         │
│  • Recherche web en direct                                  │
│  • ~/.ax-grok/ configuration                                │
├─────────────────────────────────────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Fonctionnalités partagées : 17 outils, client MCP,          │
│  mémoire, checkpoints, UI React/Ink, opérations de fichiers, │
│  support git                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Installer ? | Description |
|---------|:-----------:|-------------|
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Oui** | CLI optimisé pour Grok avec recherche web, vision, pensée étendue |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Optionnel | CLI local-first pour Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Non | Bibliothèque cœur partagée (auto-installée comme dépendance) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Non | Schémas Zod partagés (auto-installés comme dépendance) |

> **Utilisateurs GLM Cloud :** Pour l'API GLM cloud, nous recommandons [OpenCode](https://opencode.ai).

---

## Changelog

| Version | Highlights |
|---------|------------|
| **v5.1.19** | Performance : analyse des dépendances O(N×M) → O(N+M), éviction de cache optimisée, corrections UI |
| **v5.1.18** | Refactorisation : constantes nommées, noms de variables unifiés, 6,205 tests réussis |
| **v5.1.17** | Fix : bug d'annulation ESC, fuites de timer, gestion des timeouts MCP |

[Voir le changelog complet sur GitHub →](https://github.com/defai-digital/ax-cli/releases)

---

## Documentation

- [Fonctionnalités](docs/features.md)
- [Configuration](docs/configuration.md)
- [Référence CLI](docs/cli-reference.md)
- [Intégration MCP](docs/mcp.md)
- [Guide AutomatosX](docs/AutomatosX-Integration.md)
- [Guide VSCode](docs/vscode-integration-guide.md)
- [Intégration Figma](docs/figma-guide.md)
- [Dépannage](docs/troubleshooting.md)

---

## Enterprise

Pour les équipes ayant besoin de capacités avancées :

- Rapports de conformité (SOC2, HIPAA)
- Journalisation d'audit avancée
- Intégration SSO/SAML
- Support prioritaire (SLA 24 heures)

Contact : **sales@defai.digital**

---

## Licence

Licence MIT - voir [LICENSE](LICENSE)

---

<p align="center">
  Fait avec ❤️ par <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
