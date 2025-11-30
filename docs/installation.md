# AX CLI Installation Guide

A comprehensive guide to installing and verifying AX CLI on your system.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Global Installation](#global-installation)
4. [Local Development Setup](#local-development-setup)
5. [Platform-Specific Instructions](#platform-specific-instructions)
6. [Alternative Installation Methods](#alternative-installation-methods)
7. [Verification Steps](#verification-steps)
8. [Common Installation Issues](#common-installation-issues)
9. [Uninstallation](#uninstallation)

---

## Prerequisites

Before installing AX CLI, ensure your system meets these requirements:

### Supported Platforms

AX CLI officially supports the following operating systems:

| Platform | Versions | Architecture | Status |
|----------|----------|--------------|--------|
| 🍎 **macOS** | 26+ | x64, ARM64 (Apple Silicon) | ✅ Officially Supported |
| 🪟 **Windows** | 11+ | x64, ARM64 | ✅ Officially Supported |
| 🐧 **Ubuntu** | 24.04 LTS+ | x64, ARM64 | ✅ Officially Supported |

**Other Linux distributions** (Debian, Fedora, CentOS, etc.) should work but are not officially tested.

**Note:** AX CLI may work on older platform versions, but the versions listed above are officially tested and supported.

### Required

#### Node.js 24+ (Critical Requirement)

AX CLI requires **Node.js version 24.0.0 or higher** and uses ESM (ECMAScript Modules) exclusively.

**Check your current Node.js version:**

```bash
node --version  # Should output v24.0.0 or higher
```

**Install Node.js 24+:**

Visit [nodejs.org](https://nodejs.org/) and download the **latest LTS or current version**.

Alternatively, use a Node version manager:

**Using NVM (macOS/Linux):**
```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 24
nvm install 24
nvm use 24

# Verify installation
node --version  # v24.x.x
npm --version   # 10.x.x or higher
```

**Using Homebrew (macOS):**
```bash
# Install or upgrade Node.js
brew install node@24

# Link it
brew link node@24
```

**Using Windows (Chocolatey):**
```powershell
choco install nodejs  # Installs latest LTS
```

**Using Windows (Windows Installer):**
Download and run the installer from [nodejs.org](https://nodejs.org/)

### Optional

#### For Offline/Local Operation

If you want to run AX CLI completely offline without cloud API keys:

- **Ollama 0.1.0+** - Local LLM inference engine
  - Download: https://ollama.ai
  - Supported models: GLM 4.6, Llama 3, Qwen 2.5, DeepSeek, and more

- **System Resources:**
  - **RAM**: 16GB minimum (32GB recommended for larger models)
  - **Disk Space**: 5-20GB depending on which models you download
  - **GPU** (optional): Recommended for faster inference, but CPU is supported

#### For Cloud Providers

If using cloud-based AI services:

- **API Key** from one of:
  - Z.AI (GLM models) - https://z.ai
  - X.AI (Grok) - https://x.ai
  - OpenAI - https://platform.openai.com
  - Anthropic (Claude) - https://console.anthropic.com
  - Google (via OpenRouter) - https://openrouter.ai
  - Groq - https://console.groq.com
  - Any OpenAI-compatible endpoint

---

## Quick Start

The fastest way to get started:

```bash
# Install globally (recommended)
npm install -g @defai.digital/ax-cli

# Verify installation
ax-cli --version

# Run setup to configure API key and defaults
ax-cli setup

# Start using AX CLI
ax-cli --prompt "Hello, introduce yourself"
```

---

## Global Installation

### Using npm (Recommended)

```bash
# Install globally
npm install -g @defai.digital/ax-cli

# Verify installation
ax-cli --version

# Configure with your API key
ax-cli setup

# Test it
ax-cli --prompt "What is your name?"
```

**Advantages:**
- Works across all projects in your system
- Single installation point
- Easy to update

### Using Bun (Faster)

If you have [Bun](https://bun.sh/) installed (JavaScript runtime faster than Node):

```bash
# Install globally with bun
bun add -g @defai.digital/ax-cli

# Verify
ax-cli --version
```

**Advantages:**
- Faster package installation
- Compatible with Node.js packages
- Modern JavaScript runtime

### Using Yarn

```bash
# Install globally
yarn global add @defai.digital/ax-cli

# Verify
ax-cli --version
```

### Using pnpm

```bash
# Install globally
pnpm add -g @defai.digital/ax-cli

# Verify
ax-cli --version
```

### Updating Global Installation

```bash
# Update to latest version
npm update -g @defai.digital/ax-cli

# Check current version
ax-cli --version
```

---

## Local Development Setup

For developers who want to contribute or run the CLI from source:

### Prerequisites for Development

- Git
- Node.js 24+
- npm, Bun, or pnpm

### Installation Steps

#### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/defai-digital/ax-cli.git
cd ax-cli
```

#### Step 2: Install Dependencies

Using npm:
```bash
npm install
```

Using Bun (faster):
```bash
bun install
```

Using pnpm:
```bash
pnpm install
```

#### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

#### Step 4: Link for Global Development Use

Make the CLI available globally while developing:

```bash
# Link globally
npm link

# Now you can use ax-cli from anywhere
ax-cli --version
```

To unlink later:
```bash
npm unlink -g @defai.digital/ax-cli
```

#### Step 5: Verify Development Setup

```bash
# Run tests
npm test

# Generate coverage report
npm run test:coverage

# Run in interactive development mode
npm run dev

# Or run specific command in dev mode
npm run dev -- --prompt "List all .ts files"
```

### Development Commands Reference

```bash
# Type checking (no compilation)
npm run typecheck

# Linting
npm run lint

# Test in watch mode (interactive)
npm run test:watch

# Test with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Build TypeScript
npm run build

# Run development mode (using Bun)
npm run dev

# Run development mode (using Node/tsx)
npm run dev:node

# Run built CLI
npm start
```

---

## Platform-Specific Instructions

### macOS

#### Requirements
- macOS 11+ (Big Sur or newer)
- Xcode Command Line Tools (for development)

#### Installation

**Install Xcode Command Line Tools:**
```bash
xcode-select --install
```

**Install Node.js 24+ (using Homebrew - Recommended):**
```bash
# Install Homebrew if needed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@24

# Create symlink (if needed)
brew link node@24

# Verify
node --version
```

**Install AX CLI:**
```bash
npm install -g @defai.digital/ax-cli
ax-cli --version
```

**For Offline Setup with Ollama:**
```bash
# Install Ollama
brew install ollama

# Or download from https://ollama.ai/download

# Start Ollama server
ollama serve

# In another terminal, pull a model
ollama pull glm4:9b

# Configure AX CLI (see configuration guide)
```

### Linux

#### Requirements
- Ubuntu 20.04+, Debian 11+, or other modern distributions
- Build tools for Node.js (optional, only if compiling from source)

#### Installation

**Install Node.js 24+ (using NodeSource Repository - Recommended):**

For Ubuntu/Debian:
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

For Fedora/RHEL/CentOS:
```bash
# Add NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -

# Install Node.js
sudo dnf install nodejs

# Verify
node --version
npm --version
```

**Install AX CLI:**
```bash
npm install -g @defai.digital/ax-cli
ax-cli --version
```

**For Offline Setup with Ollama:**
```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version

# Start Ollama server (runs as service or manually)
ollama serve

# Pull a model
ollama pull glm4:9b
```

#### Troubleshooting (Linux)

**npm install: EACCES permission denied**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g @defai.digital/ax-cli

# Option 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Add to ~/.bashrc or ~/.zshrc:
# export PATH=~/.npm-global/bin:$PATH

# Then install
npm install -g @defai.digital/ax-cli
```

### Windows

#### Requirements
- Windows 10/11 (64-bit)
- Administrator access (for installation)
- Terminal (Windows Terminal recommended for better UX)

#### Installation

**Install Node.js 24+ (Recommended: Using Installer):**

1. Visit https://nodejs.org/
2. Download the Windows Installer (LTS or Current version)
3. Run the installer
4. Follow the installation wizard (default settings OK)
5. Restart your terminal/PowerShell

**Verify Installation:**
```powershell
node --version
npm --version
```

**Alternative: Using Chocolatey:**
```powershell
# Install Chocolatey if needed (run as Administrator):
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Verify
node --version
npm --version
```

**Install AX CLI:**

Open PowerShell as Administrator:
```powershell
npm install -g @defai.digital/ax-cli
ax-cli --version
```

#### Windows-Specific Notes

**Path Issues:**

If `ax-cli` command not found, the npm global bin directory may not be in your PATH:

```powershell
# Check npm global bin directory
npm config get prefix

# Should output something like: C:\Users\YourName\AppData\Roaming\npm

# Add to PATH if needed (Windows Settings > Environment Variables)
# Or use full path: & 'C:\Users\YourName\AppData\Roaming\npm\ax-cli'
```

**Terminal Recommendations:**

- **Windows Terminal** (modern, recommended): https://apps.microsoft.com/store/detail/windows-terminal
- PowerShell 7+: More compatible with Node.js tools
- Avoid: Legacy Command Prompt (cmd.exe) - has encoding issues

**For Offline Setup with Ollama (Windows):**

```powershell
# Download Ollama installer
# Visit: https://ollama.ai/download/windows

# Or use Chocolatey
choco install ollama

# Run Ollama
ollama serve

# In another terminal
ollama pull glm4:9b

# Test
ollama run glm4:9b "Hello"
```

---

## Alternative Installation Methods

### Install from Source

For developers or those wanting the absolute latest unreleased version:

```bash
# Clone repository
git clone https://github.com/defai-digital/ax-cli.git
cd ax-cli

# Install dependencies
npm install

# Build
npm run build

# Install globally from built version
npm install -g .

# Or use npm link for development
npm link

# Verify
ax-cli --version
```

### Using npx (No Installation Required)

Run AX CLI without installing:

```bash
npx @defai.digital/ax-cli --prompt "Your prompt here"
npx @defai.digital/ax-cli --version
npx @defai.digital/ax-cli init
```

**Advantages:**
- No disk space used
- Always latest version
- No global installation conflicts

**Disadvantages:**
- Slower first run (downloads each time)
- Less convenient for frequent use

### Docker Installation

If you have Docker installed:

```bash
# Build Docker image
docker build -t ax-cli .

# Run container
docker run --rm -v $(pwd):/workspace ax-cli --prompt "Your prompt"
```

### Portable Installation (No System Changes)

Run AX CLI in a self-contained directory:

```bash
# Create directory
mkdir ax-cli-portable
cd ax-cli-portable

# Initialize npm project
npm init -y

# Install AX CLI as local dependency
npm install @defai.digital/ax-cli

# Run
npx ax-cli --version

# Or create wrapper script
cat > ax-cli.sh << 'EOF'
#!/bin/bash
./node_modules/.bin/ax-cli "$@"
EOF
chmod +x ax-cli.sh

# Use
./ax-cli.sh --prompt "Hello"
```

---

## Verification Steps

After installation, verify everything works correctly:

### 1. Check Installation

```bash
# Verify ax-cli is installed
ax-cli --version

# Output should be: @defai.digital/ax-cli v1.1.3 (or later)
```

### 2. Check Node.js Compatibility

```bash
# Verify Node.js version
node --version

# Should be v24.0.0 or higher
```

### 3. Test Basic Functionality

```bash
# Test headless mode (no API key needed for this test)
ax-cli --prompt "What is 2 + 2?" --max-tool-rounds 1

# Or interactive mode (requires configuration)
ax-cli
```

### 4. Test with a Provider (Optional)

**Offline with Ollama:**
```bash
# Start Ollama (if not running)
ollama serve &

# Configure AX CLI
mkdir -p ~/.ax-cli
cat > ~/.ax-cli/config.json << 'EOF'
{
  "baseURL": "http://localhost:11434/v1",
  "defaultModel": "glm4:9b"
}
EOF

# Test
ax-cli --prompt "Hello from AX CLI"
```

**Cloud Provider Example (X.AI/Grok):**
```bash
# Set API key
export YOUR_API_KEY="your_api_key_here"

# Test
ax-cli --api-key "your_api_key_here" \
        --base-url "https://api.x.ai/v1" \
        --model "grok-code-fast-1" \
        --prompt "Hello"
```

### 5. List Available Commands

```bash
ax-cli --help

# Output should show available commands and options
```

### 6. Check Configuration Paths

```bash
# Check where configurations are loaded from
cat ~/.ax-cli/config.json      # User settings (if exists)
cat .ax-cli/settings.json      # Project settings (if exists)
```

---

## Common Installation Issues

### Issue: "Node version too old" or "Node 24+ required"

**Symptom:**
```
Error: AX CLI requires Node.js 24.0.0 or higher
```

**Solution:**
1. Check current version: `node --version`
2. Update Node.js to version 24+
   - Visit https://nodejs.org/
   - Or use NVM: `nvm install 24`
3. Verify: `node --version`

### Issue: "ax-cli command not found"

**Causes:**
- npm global path not in system PATH
- Installation failed silently
- Using wrong package manager

**Solutions:**

Check where npm installs globally:
```bash
npm config get prefix
```

Add npm bin directory to PATH:

**macOS/Linux:**
```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile:
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload shell
source ~/.bashrc  # or .zshrc
```

**Windows (PowerShell):**
Use Windows Settings > Environment Variables to add npm bin directory to PATH

**Alternative - Use npx:**
```bash
npx @defai.digital/ax-cli --version
```

**Reinstall:**
```bash
npm uninstall -g @defai.digital/ax-cli
npm install -g @defai.digital/ax-cli
```

### Issue: "Cannot find module" or "ERR! code ENOENT"

**Symptom:**
```
Error: Cannot find module '@defai.digital/ax-cli'
```

**Solutions:**

**Fix 1: Clear npm cache**
```bash
npm cache clean --force
npm install -g @defai.digital/ax-cli
```

**Fix 2: Reinstall npm**
```bash
npm install -g npm@latest
npm install -g @defai.digital/ax-cli
```

**Fix 3: Check npm registry**
```bash
npm config set registry https://registry.npmjs.org/
npm install -g @defai.digital/ax-cli
```

### Issue: "EACCES: permission denied" (macOS/Linux)

**Symptom:**
```
npm ERR! code EACCES
npm ERR! syscall mkdir
npm ERR! path /usr/local/lib/node_modules
```

**Solutions:**

**Option 1: Fix npm permissions (Recommended)**
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
# Add to ~/.bashrc or ~/.zshrc permanently

npm install -g @defai.digital/ax-cli
```

**Option 2: Use sudo (Not Recommended)**
```bash
sudo npm install -g @defai.digital/ax-cli
```

### Issue: "Registry errors" or "Failed to download package"

**Symptom:**
```
npm ERR! 404 Not Found
npm ERR! code E404
```

**Solutions:**

**Check npm registry:**
```bash
npm config get registry
# Should be: https://registry.npmjs.org/

# Reset to default if needed
npm config set registry https://registry.npmjs.org/
```

**Retry with increased timeout:**
```bash
npm install -g @defai.digital/ax-cli --fetch-timeout=120000
```

**Use different registry:**
```bash
npm install -g @defai.digital/ax-cli --registry https://registry.yarnpkg.com
```

### Issue: Development Setup - "npm run build" fails

**Symptom:**
```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solution:**

Check TypeScript version and dependencies:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify TypeScript
npm run typecheck

# Then build
npm run build
```

### Issue: Ollama Connection Error

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:11434
```

**Solution:**

Ensure Ollama is running:
```bash
# macOS
brew services start ollama

# Linux
sudo systemctl start ollama

# Windows or manual
ollama serve  # Run in separate terminal

# Verify connection
curl http://localhost:11434/api/tags
```

### Issue: API Key Not Working

**Symptom:**
```
Error: 401 Unauthorized
```

**Solutions:**

1. Verify API key is correct:
   - Check your provider dashboard (X.AI, OpenAI, etc.)
   - Ensure key hasn't expired
   - Regenerate if needed

2. Check configuration:
```bash
# Verify key is set
echo $YOUR_API_KEY  # Should not be empty

# Or check config file
cat ~/.ax-cli/config.json
```

3. Use environment variable directly:
```bash
export YOUR_API_KEY="your_key_here"
ax-cli --prompt "Test"
```

### Issue: "TypeScript compilation errors" in development

**Symptom:**
```
error TS1208: All files must be modules when the '--isolatedModules' flag is set
```

**Solution:**

This is usually due to Node version mismatch:
```bash
# Verify Node version
node --version  # Must be 24+

# Clear build artifacts
rm -rf dist/

# Rebuild
npm run build

# Or check TypeScript version
npm list typescript
# Should be 5.9.3+
```

---

## Uninstallation

### Uninstall Global Installation

```bash
# Using npm
npm uninstall -g @defai.digital/ax-cli

# Using bun
bun remove -g @defai.digital/ax-cli

# Using yarn
yarn global remove @defai.digital/ax-cli

# Using pnpm
pnpm remove -g @defai.digital/ax-cli

# Verify uninstallation
ax-cli --version  # Should output: command not found
```

### Uninstall Local Development

```bash
# Navigate to project directory
cd ax-cli

# Unlink global development link
npm unlink

# Remove local installation
rm -rf node_modules package-lock.json

# Remove build artifacts (optional)
rm -rf dist/
```

### Remove Configuration Files (Optional)

```bash
# Remove user settings
rm -rf ~/.ax-cli/

# Or just remove config
rm ~/.ax-cli/config.json

# Remove project settings (in project directory)
rm .ax-cli/settings.json
```

---

## Next Steps

After successful installation, proceed with:

1. **Configuration**: See [Configuration Guide](./configuration.md)
   - Set up API keys or offline Ollama
   - Configure default models
   - Set up custom instructions

2. **Project Initialization**: See [README](../README.md#-project-initialization)
   - Run `ax-cli init` in your project
   - Generate custom instructions automatically

3. **Usage**: See [CLI Reference](./cli-reference.md)
   - Learn available commands
   - Understand command-line options
   - See practical examples

4. **Integration**: See [MCP Integration Guide](./mcp-integration-guide.md)
   - Extend capabilities with MCP servers
   - Add custom tools and context

5. **Advanced**: See [Architecture Guide](./architecture.md)
   - Understand system design
   - Learn how to extend AX CLI
   - Review best practices

---

## Getting Help

If you encounter issues not covered here:

1. **Check GitHub Issues**: https://github.com/defai-digital/ax-cli/issues
2. **Read Docs**: https://github.com/defai-digital/ax-cli/docs/
3. **Report Bug**: https://github.com/defai-digital/ax-cli/issues/new

---

## Environment Variables Reference

Key environment variables for AX CLI:

```bash
# API Configuration
YOUR_API_KEY="your_api_key"           # API key for provider
AI_BASE_URL="https://api.x.ai/v1"   # API endpoint
AI_MODEL="glm-4.6"                  # Default model

# Token Management
AI_MAX_TOKENS="128000"               # Max tokens for responses

# Temperature
AI_TEMPERATURE="0.7"                 # Sampling temperature

# Debug
DEBUG="1"                              # Enable debug logging
```

---

## Version Information

- **Current Version**: 3.8.7
- **Node.js Required**: 24.0.0+
- **TypeScript**: 5.9.3+
- **License**: MIT

For the latest version, visit: https://github.com/defai-digital/ax-cli/releases

