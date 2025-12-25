# AX CLI - Codage IA de Classe Entreprise

> 📖 Cette traduction est basée sur [README.md @ v5.1.8](./README.md)

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

## Table des Matières

- [Démarrage Rapide](#démarrage-rapide)
- [Pourquoi AX CLI ?](#pourquoi-ax-cli)
- [Modèles Supportés](#modèles-supportés)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Intégration MCP](#intégration-mcp)
- [Extension VSCode](#extension-vscode)
- [Intégration AutomatosX](#intégration-automatosx)
- [Mémoire du Projet](#mémoire-du-projet)
- [Sécurité](#sécurité)
- [Architecture](#architecture)
- [Packages](#packages)

---

<p align="center">
  <img src=".github/assets/glm.png" alt="AX-GLM" width="400"/>
  <img src=".github/assets/grok.png" alt="AX-Grok" width="400"/>
</p>

<p align="center">
  <strong>Assistant de codage IA de niveau entreprise optimisé pour GLM et Grok</strong>
</p>

## Démarrage Rapide

Commencez en moins d'une minute. Choisissez votre fournisseur d'IA et installez la CLI dédiée :

<table>
<tr>
<td width="50%">

### GLM (Z.AI)

```bash
npm install -g @defai.digital/ax-glm
ax-glm setup
ax-glm
```

**Idéal pour :** Contexte 200K, mode de réflexion, support de la langue chinoise

</td>
<td width="50%">

### Grok (xAI)

```bash
npm install -g @defai.digital/ax-grok
ax-grok setup
ax-grok
```

**Idéal pour :** Recherche web en direct, vision, raisonnement étendu

</td>
</tr>
</table>

Exécutez `/init` dans la CLI pour initialiser le contexte de votre projet.

> **Quelle CLI dois-je installer ?** Installez `ax-glm` si vous avez une clé API Z.AI, ou `ax-grok` si vous avez une clé API xAI. Les deux fournissent le même assistant de codage complet, optimisé pour leurs fournisseurs respectifs.

---

## Pourquoi AX CLI ?

| Fonctionnalité | Description |
|----------------|-------------|
| **Optimisé par Fournisseur** | Support de première classe pour GLM (Z.AI) et Grok (xAI) avec paramètres spécifiques au fournisseur |
| **17 Outils Intégrés** | Édition de fichiers, exécution bash, recherche, todos et plus |
| **Comportements Agentiques** | Boucles de raisonnement ReAct, auto-correction sur échecs, vérification TypeScript |
| **Agents AutomatosX** | 20+ agents IA spécialisés pour backend, frontend, sécurité, DevOps et plus |
| **Correction Autonome de Bugs** | Scanne et corrige automatiquement les fuites de minuteries, problèmes de ressources, erreurs de type avec sécurité de rollback |
| **Refactorisation Intelligente** | Suppression de code mort, corrections de sécurité de types, réduction de complexité avec vérification |
| **Intégration MCP** | Model Context Protocol avec 12+ modèles prêts pour la production |
| **Mémoire du Projet** | Cache de contexte intelligent avec 50% d'économie de tokens |
| **Sécurité Entreprise** | Chiffrement AES-256-GCM, pas de télémétrie, protections notées CVSS |
| **65% Couverture de Tests** | 6 084+ tests avec TypeScript strict |

---

### Points Forts des Fournisseurs (GLM + Grok)

- **GLM (ax-glm)** : Contexte 200K, **GLM 4.7** avec raisonnement amélioré et codage optimisé, support thinking_mode, forte performance en chinois, vision via `glm-4.6v`, itérations rapides via `glm-4-flash`.
- **Grok (ax-grok)** : Recherche web intégrée, vision, reasoning_effort ; **Les variantes rapides Grok 4.1 incluent contexte 2M, outils serveur parallèles, x_search et exécution de code côté serveur**.
- Les deux CLIs partagent la même chaîne d'outils (édition de fichiers, MCP, bash) et mémoire de projet ; choisissez le fournisseur correspondant à votre clé API.
- Installez les deux pour exécuter en parallèle avec état isolé (`.ax-glm`, `.ax-grok`) pour des comparaisons côte à côte.

---

## Modèles Supportés

### GLM (Z.AI)

| Modèle | Contexte | Fonctionnalités | Alias |
|--------|----------|-----------------|-------|
| `glm-4.7` | 200K | **Dernier modèle** : Raisonnement amélioré, codage optimisé, meilleure performance globale | `glm-latest` |
| `glm-4.6` | 200K | **Mode réflexion** : Processus de pensée détaillés et planification | `glm-thinking` |
| `glm-4.6v` | 128K | **Vision + Réflexion** : Dernier modèle de vision avec appel de fonction multimodal natif | `glm-vision` |
| `glm-4-flash` | 128K | Rapide, efficace pour les tâches rapides | `glm-fast` |
| `cogview-4` | - | **Génération d'images** : Texte vers image avec résolutions variables | `glm-image` |

### Grok (xAI)

| Modèle | Contexte | Fonctionnalités | Alias |
|--------|----------|-----------------|-------|
| `grok-4.1` | 131K | Défaut équilibré avec raisonnement, vision et recherche intégrés | `grok-latest` |
| `grok-4.1-fast-reasoning` | 2M | Idéal pour sessions agentiques/intensives en outils avec raisonnement | `grok-fast` |
| `grok-4.1-fast-non-reasoning` | 2M | Exécutions agentiques les plus rapides sans raisonnement étendu | `grok-fast-nr` |
| `grok-4-0709` | 131K | Version originale Grok 4 (compatible) | `grok-4` |
| `grok-2-image-1212` | 32K | **Génération d'images** : Texte vers image | `grok-image` |

> **Alias de Modèles** : Utilisez des alias pratiques comme `ax-grok -m grok-latest` au lieu des noms complets de modèles.

---

## Installation

### Prérequis

- Node.js 24.0.0+
- macOS 14+, Windows 11+ ou Ubuntu 24.04+

### Commande d'Installation

```bash
# Choisissez votre fournisseur
npm install -g @defai.digital/ax-glm    # GLM (Z.AI)
npm install -g @defai.digital/ax-grok   # Grok (xAI)
```

### Configuration

```bash
ax-glm setup   # ou ax-grok setup
```

L'assistant de configuration vous guidera à travers :
1. Chiffrer et stocker votre clé API de manière sécurisée (en utilisant le chiffrement AES-256-GCM)
2. Configurer votre modèle IA par défaut et autres préférences
3. Valider votre configuration pour s'assurer que tout est correctement configuré

---

## Utilisation

### Mode Interactif

```bash
ax-glm              # Démarre la session CLI interactive
ax-glm --continue   # Reprendre la conversation précédente
ax-glm -c           # Forme courte
```

### Mode Headless

```bash
ax-glm -p "analyse cette base de code"
ax-glm -p "corrige les erreurs TypeScript" -d /chemin/vers/projet
```

### Drapeaux de Comportement Agentique

```bash
# Activer le mode de raisonnement ReAct (cycles Pensée → Action → Observation)
ax-glm --react

# Activer la vérification TypeScript après les phases de planification
ax-glm --verify

# Désactiver l'auto-correction sur échecs
ax-glm --no-correction
```

Par défaut, l'auto-correction est ACTIVÉE (l'agent réessaie automatiquement sur échecs avec réflexion). ReAct et vérification sont DÉSACTIVÉS par défaut mais peuvent être activés pour un raisonnement plus structuré et des vérifications de qualité.

### Commandes Essentielles

| Commande | Description |
|----------|-------------|
| `/init` | Initialiser le contexte du projet |
| `/help` | Afficher toutes les commandes |
| `/model` | Changer de modèle IA |
| `/lang` | Changer la langue d'affichage (11 langues) |
| `/doctor` | Exécuter les diagnostics |
| `/exit` | Quitter la CLI |

### Raccourcis Clavier

| Raccourci | Action | Description |
|-----------|--------|-------------|
| `Ctrl+O` | Basculer verbosité | Afficher ou masquer les logs détaillés et processus internes |
| `Ctrl+K` | Actions rapides | Ouvrir le menu d'actions rapides pour les commandes courantes |
| `Ctrl+B` | Mode arrière-plan | Exécuter la tâche actuelle en arrière-plan |
| `Shift+Tab` | Auto-édition | Déclencher les suggestions de code par IA |
| `Esc` ×2 | Annuler | Effacer l'entrée actuelle ou annuler l'opération en cours |

---

## Configuration

### Fichiers de Configuration

| Fichier | But |
|---------|-----|
| `~/.ax-glm/config.json` | Paramètres utilisateur (clé API chiffrée) |
| `.ax-glm/settings.json` | Surcharges du projet |
| `.ax-glm/CUSTOM.md` | Instructions IA personnalisées |
| `ax.index.json` | Index partagé du projet (à la racine, utilisé par toutes les CLIs) |

> Grok utilise les répertoires `~/.ax-grok/` et `.ax-grok/`. Le `ax.index.json` est partagé.

### Variables d'Environnement

```bash
# Pour CI/CD
export ZAI_API_KEY=your_key    # GLM
export XAI_API_KEY=your_key    # Grok
```

---

## Intégration MCP

Étendez les capacités avec [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — un standard ouvert pour connecter les assistants IA aux outils externes, APIs et sources de données :

```bash
ax-glm mcp add figma --template
ax-glm mcp add github --template
ax-glm mcp list
```

**Modèles Disponibles :** Figma, GitHub, Vercel, Puppeteer, Storybook, Sentry, Jira, Confluence, Slack, Google Drive et plus.

---

## Extension VSCode

```bash
code --install-extension defai-digital.ax-cli-vscode
```

- Panneau de chat dans la barre latérale
- Aperçu des différences pour les modifications de fichiers
- Commandes contextuelles
- Système de points de contrôle et retour en arrière

---

## Intégration AutomatosX

AX CLI s'intègre avec [AutomatosX](https://github.com/defai-digital/automatosx) - un système IA multi-agents avec correction autonome de bugs, refactorisation intelligente et 20+ agents spécialisés.

En mode interactif (`ax-glm` ou `ax-grok`), demandez simplement naturellement :

```
> s'il vous plaît scannez et corrigez les bugs dans cette base de code

> refactorisez le module d'authentification, concentrez-vous sur la suppression du code mort

> utilisez l'agent de sécurité pour auditer les points de terminaison de l'API
```

**Ce que vous obtenez :**
- **Correction de bugs** : Détecte les fuites de minuteries, nettoyage manquant, problèmes de ressources - corrige automatiquement avec sécurité de rollback
- **Refactorisation** : Supprime le code mort, corrige la sécurité des types, réduit la complexité - vérifié par vérification de types
- **20+ agents** : Backend, frontend, sécurité, architecture, DevOps, données et plus

---

## Mémoire du Projet

Réduisez les coûts de tokens et améliorez le rappel de contexte avec un cache intelligent qui stocke et récupère les informations pertinentes du projet, évitant le traitement redondant.

```bash
ax-glm memory warmup    # Générer le cache de contexte
ax-glm memory status    # Voir la distribution des tokens
```

---

## Sécurité

- **Chiffrement de Clé API :** AES-256-GCM avec PBKDF2 (600K itérations)
- **Pas de Télémétrie :** Zéro collecte de données
- **Protections CVSS :** Garde-fous robustes contre les vulnérabilités courantes comme l'Injection de Commande (CVSS 9.8), Path Traversal (CVSS 8.6) et SSRF (CVSS 7.5)

---

## Architecture

AX CLI utilise une architecture modulaire avec des CLIs spécifiques par fournisseur construites sur un noyau partagé :

```
┌─────────────────────────────────────────────────────────────┐
│                  Installation Utilisateur                    │
├─────────────────────────────┬───────────────────────────────┤
│      @defai.digital/ax-glm  │    @defai.digital/ax-grok     │
│         (ax-glm CLI)        │       (ax-grok CLI)           │
│                             │                               │
│  • Mode réflexion GLM-4.6   │  • Raisonnement étendu        │
│  • Défauts API Z.AI         │  • Défauts API xAI            │
│  • Fenêtre contexte 200K    │  • Recherche web en direct    │
│  • Configuration ~/.ax-glm/ │  • Configuration ~/.ax-grok/  │
├─────────────────────────────┴───────────────────────────────┤
│                   @defai.digital/ax-core                    │
│                                                             │
│  Fonctionnalité partagée : 17 outils, client MCP, mémoire,  │
│  checkpoints, React/Ink UI, opérations de fichiers, git     │
└─────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Installer ? | Description |
|---------|:-----------:|-------------|
| [@defai.digital/ax-glm](https://www.npmjs.com/package/@defai.digital/ax-glm) | **Oui** | CLI optimisée pour GLM avec recherche web, vision, génération d'images |
| [@defai.digital/ax-grok](https://www.npmjs.com/package/@defai.digital/ax-grok) | **Oui** | CLI optimisée pour Grok avec recherche web, vision, réflexion étendue |
| [@defai.digital/ax-cli](https://www.npmjs.com/package/@defai.digital/ax-cli) | Optionnel | CLI local-first pour Ollama/LMStudio/vLLM + DeepSeek Cloud |
| [@defai.digital/ax-core](https://www.npmjs.com/package/@defai.digital/ax-core) | Non | Bibliothèque noyau partagée (installée automatiquement comme dépendance) |
| [@defai.digital/ax-schemas](https://www.npmjs.com/package/@defai.digital/ax-schemas) | Non | Schémas Zod partagés (installés automatiquement comme dépendance) |

---

## Licence

Licence MIT - voir [LICENSE](LICENSE)

---

<p align="center">
  Fait avec amour par <a href="https://github.com/defai-digital">DEFAI Digital</a>
</p>
