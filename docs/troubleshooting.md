# AX CLI Troubleshooting Guide

A comprehensive guide to diagnosing and resolving common issues with AX CLI.

---

## Table of Contents

1. [Installation Problems](#installation-problems)
2. [API Key Issues](#api-key-issues)
3. [Model Connection Errors](#model-connection-errors)
4. [MCP Server Problems](#mcp-server-problems)
5. [Performance Issues](#performance-issues)
6. [Configuration Errors](#configuration-errors)
7. [Common Error Messages](#common-error-messages)
8. [Debug Mode and Logging](#debug-mode-and-logging)
9. [Getting Help](#getting-help)

---

## Installation Problems

### Problem: Command not found after installation

**Symptoms:**
```bash
ax-cli: command not found
bash: ax-cli: command not found
```

**Solutions:**

**1. Global npm installation**
```bash
# Install globally
npm install -g @defai.digital/ax-cli

# Verify installation
which ax-cli
ax-cli --version
```

**2. If using npm link for development**
```bash
# Reinstall npm link
npm link

# Verify symlink
which ax-cli
ls -la $(which ax-cli)
```

**3. Refresh shell PATH**
```bash
# After installation, restart terminal or source shell config
source ~/.bashrc          # Bash
source ~/.zshrc           # Zsh
exec $SHELL              # Any shell
```

**4. Check npm installation directory**
```bash
# Verify npm's bin directory is in PATH
echo $PATH | grep -o npm_prefix
npm config get prefix     # Should include /usr/local/bin or ~/.npm-global
```

**5. Manual installation path**
```bash
# If still not working, find and link manually
find /usr/local -name ax-cli 2>/dev/null
ln -s /path/to/ax-cli /usr/local/bin/ax-cli
```

---

### Problem: Version conflicts or incompatible Node.js

**Symptoms:**
```
Error: AX CLI requires Node.js 24.0.0 or higher
Your Node.js version: 20.x.x
```

**Solutions:**

**1. Update Node.js**
```bash
# Check current version
node --version

# Option A: Using nvm (Node Version Manager)
nvm install 24
nvm use 24
nvm alias default 24

# Option B: Using Homebrew (macOS)
brew install node@24
brew link node@24 --force

# Option C: Using apt (Linux)
sudo apt update
sudo apt install nodejs=24.*
```

**2. Verify updated installation**
```bash
node --version  # Should show v24.x.x
npm --version
ax-cli --version
```

---

### Problem: Module resolution errors during installation

**Symptoms:**
```
Error: Cannot find module 'zod'
Error: ENOENT: no such file or directory
Module not found: '@ax-cli/schemas'
```

**Solutions:**

**1. Clean reinstall**
```bash
# Remove node_modules and lock file
rm -rf node_modules package-lock.json yarn.lock bun.lockb

# Reinstall dependencies
npm install

# Or with other package managers
yarn install
bun install
```

**2. Clear npm cache**
```bash
npm cache clean --force
npm install -g @defai.digital/ax-cli
```

**3. Force package resolution**
```bash
# If using private npm registry
npm install --legacy-peer-deps
```

**4. Check monorepo setup**
```bash
# If developing locally, ensure schemas package is built
cd packages/schemas
npm install
npm run build
cd ../..
npm install
```

---

### Problem: Permission denied during installation

**Symptoms:**
```
Error: EACCES: permission denied
npm ERR! code EACCES
```

**Solutions:**

**1. Fix npm permissions (Recommended)**
```bash
# Create npm directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**2. Use sudo (Not recommended)**
```bash
# Only if absolutely necessary
sudo npm install -g @defai.digital/ax-cli
```

**3. Change ownership**
```bash
# Fix existing installation
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin
```

---

## API Key Issues

### Problem: "API key required" error

**Symptoms:**
```
Error: API key required. Set YOUR_API_KEY environment variable,
use --api-key flag, or save to ~/.ax/user-settings.json
```

**Solutions:**

**1. Set environment variable (One-time)**
```bash
# For current session
export YOUR_API_KEY="your_api_key_here"
ax-cli -p "test prompt"

# Or use with command
YOUR_API_KEY="your_api_key_here" ax-cli -p "test prompt"
```

**2. Permanently set in shell config**
```bash
# For Bash (~/.bashrc)
echo 'export YOUR_API_KEY="your_api_key_here"' >> ~/.bashrc
source ~/.bashrc

# For Zsh (~/.zshrc)
echo 'export YOUR_API_KEY="your_api_key_here"' >> ~/.zshrc
source ~/.zshrc
```

**3. Create user settings file**
```bash
# Create .ax directory
mkdir -p ~/.ax

# Create user-settings.json
cat > ~/.ax/user-settings.json <<'EOF'
{
  "apiKey": "your_api_key_here",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1"
}
EOF

# Set restrictive permissions
chmod 600 ~/.ax/user-settings.json
```

**4. Use command line flag**
```bash
ax-cli -p "test" --api-key "your_api_key_here"
```

**5. Check configuration priority**
```bash
# AX CLI checks in this order:
# 1. Command line: --api-key
# 2. Environment: YOUR_API_KEY
# 3. Project: .ax/settings.json
# 4. User: ~/.ax/user-settings.json
# 5. Defaults: built-in defaults

# Debug which is being used
ax-cli --help  # Shows loaded configuration
```

---

### Problem: Invalid API key format

**Symptoms:**
```
Error: 401 Unauthorized
Error: Invalid API key
API key format is incorrect
```

**Solutions:**

**1. Verify API key format**

For **X.AI (Grok)**:
```bash
# Should start with "xai-"
echo $YOUR_API_KEY | grep "^xai-"  # Should match
```

For **Z.AI (GLM)**:
```bash
# Should match their format
# Check at https://api.z.ai
```

For **OpenRouter**:
```bash
# Should start with "sk-or-"
echo $YOUR_API_KEY | grep "^sk-or-"  # Should match
```

**2. Verify API key validity**
```bash
# Test with curl
curl -H "Authorization: Bearer $YOUR_API_KEY" \
  https://api.x.ai/v1/models \
  | head -20

# Should return list of models, not error
```

**3. Check for whitespace or special characters**
```bash
# Ensure no extra spaces
echo "$YOUR_API_KEY" | od -c | grep -E "^\s+$"  # Should be empty

# Check for common issues
echo "${#YOUR_API_KEY}"  # Should show length without spaces
```

**4. Regenerate API key**
- Visit your provider's dashboard (X.AI, Z.AI, OpenRouter)
- Regenerate or create a new API key
- Update your configuration

---

### Problem: API key leaks or exposed credentials

**Symptoms:**
```
Warning: API key found in git history
API key published to public repository
```

**Solutions:**

**1. Immediately revoke the exposed key**
- Visit your provider's dashboard
- Revoke/delete the exposed API key
- Generate a new one

**2. Remove from git history**
```bash
# If accidentally committed
git log --all -S "your_api_key" -- "*"  # Find commits

# Option A: Rebase (safer for local repos)
git rebase -i <commit-before-exposure>
# Edit commit, remove API key, save

# Option B: BFG Repo Cleaner (for shared repos)
bfg --replace-text passwords.txt .
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**3. Add to .gitignore**
```bash
# Prevent future accidents
echo "~/.ax/user-settings.json" >> .gitignore
echo ".ax/*-keys.json" >> .gitignore
echo ".env" >> .gitignore

git add .gitignore
git commit -m "Add secrets to .gitignore"
```

**4. Use environment variables for CI/CD**
```bash
# In CI/CD (GitHub Actions, GitLab CI, etc.)
# Add YOUR_API_KEY as a secret environment variable
# Never hardcode in scripts or config files
```

---

## Model Connection Errors

### Problem: "Model not found" error

**Symptoms:**
```
Error: Model 'glm-4.6' not found
Error: 404 Not Found
```

**Solutions:**

**1. Verify model name**
```bash
# List available models for your provider
ax-cli models list

# Or test specific model
ax-cli --model glm-4.6 --prompt "test"
```

**2. Check configured models in settings**
```bash
# View user settings
cat ~/.ax/user-settings.json | grep -A5 '"models"'

# View project settings
cat .ax/settings.json | grep -A5 '"models"'
```

**3. Add missing model to configuration**
```bash
# Edit ~/.ax/user-settings.json
{
  "models": [
    "glm-4.6",
    "grok-code-fast-1",
    "glm-4.5v"
  ]
}
```

**4. Use correct model identifier**
```bash
# Check model list from provider
ax-cli --help  # Shows default models

# Some providers use different naming:
# Z.AI: glm-4.6, glm-4.5v
# X.AI: grok-code-fast-1, grok-4-latest
# OpenAI: gpt-4, gpt-4o
```

---

### Problem: Connection timeout or network error

**Symptoms:**
```
Error: connect ECONNREFUSED
Error: Request timeout
ETIMEDOUT: connection timed out
```

**Solutions:**

**1. Check network connectivity**
```bash
# Test internet connection
ping 8.8.8.8          # Google DNS
curl -I https://api.x.ai/v1  # Test API endpoint

# For Ollama local server
curl -I http://localhost:11434/v1
```

**2. Verify API endpoint URL**
```bash
# Check configured base URL
cat ~/.ax/user-settings.json | grep baseURL

# Common endpoints:
# X.AI: https://api.x.ai/v1
# Z.AI: https://api.z.ai/v1
# OpenAI: https://api.openai.com/v1
# Ollama: http://localhost:11434/v1
```

**3. Test connection with curl**
```bash
# Test with API key
curl -H "Authorization: Bearer $YOUR_API_KEY" \
  -X POST https://api.x.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-code-fast-1","messages":[{"role":"user","content":"test"}]}' \
  | head -20
```

**4. Increase timeout value**
```bash
# Via environment variable
AI_TIMEOUT=60000 ax-cli -p "test"

# Or in settings
{
  "timeout": 60000
}
```

**5. For Ollama, ensure service is running**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama if needed
ollama serve

# In another terminal, pull model
ollama pull glm4:9b

# Test connection
curl http://localhost:11434/v1/models
```

---

### Problem: 401 Unauthorized or authentication failed

**Symptoms:**
```
Error: 401 Unauthorized
Error: Invalid credentials
Error: Authentication failed
```

**Solutions:**

**1. Verify API key is correctly set**
```bash
# Check in order of priority
echo $YOUR_API_KEY              # Environment variable
cat ~/.ax/user-settings.json    # User settings
cat .ax/settings.json           # Project settings
```

**2. Check for common typos**
```bash
# Look for spacing issues
echo "$YOUR_API_KEY" | sed 's/./& /g'  # Show each character

# Check length is reasonable
echo "${#YOUR_API_KEY}"  # Should be > 20 characters
```

**3. Verify API key hasn't expired**
- Visit provider's dashboard
- Check key's last activity
- Regenerate if necessary

**4. Check API key permissions**
- Some providers have scoped keys
- Ensure key has permission for model access
- Check documentation for required scopes

---

### Problem: Rate limiting or quota exceeded

**Symptoms:**
```
Error: 429 Too Many Requests
Error: Rate limit exceeded
Error: Quota exceeded
```

**Solutions:**

**1. Check rate limits**
```bash
# Check your plan's limits
# Visit provider dashboard (X.AI, Z.AI, etc.)

# For development, use free tier with limits
# Consider upgrading for higher limits
```

**2. Implement backoff strategy**
```bash
# Reduce concurrent requests
ax-cli -p "test" --max-tool-rounds 10

# Use environment variable
export AI_MAX_TOOL_ROUNDS=10
```

**3. Add delays between requests**
```bash
# Shell script with delay
for i in {1..5}; do
  ax-cli -p "request $i"
  sleep 2  # Wait 2 seconds between requests
done
```

**4. Switch to different provider**
```bash
# Temporarily use Ollama (local, unlimited)
ax-cli --base-url http://localhost:11434/v1 \
       --model glm4:9b \
       -p "test"
```

---

## MCP Server Problems

### Problem: MCP server not connecting

**Symptoms:**
```
Error: MCP server 'github' not connected
Error: Failed to connect to server
Error: Server initialization failed
```

**Solutions:**

**1. Test server connection directly**
```bash
# List configured servers
ax-cli mcp list

# Test specific server
ax-cli mcp test github

# View server details
ax-cli mcp info github
```

**2. Verify server configuration**
```bash
# Check .ax/settings.json
cat .ax/settings.json | grep -A10 '"mcpServers"'

# Configuration should be valid JSON
# Check with: cat .ax/settings.json | python -m json.tool
```

**3. For stdio transport servers**
```bash
# Verify command exists
which npx           # If using npx
which python        # If using python
which bun           # If using bun

# Test command manually
npx @modelcontextprotocol/server-github --help

# Add to PATH if needed
export PATH="/usr/local/bin:$PATH"
```

**4. For HTTP transport servers**
```bash
# Test HTTP server is accessible
curl -I http://localhost:3000

# Check configuration
{
  "transport": "http",
  "url": "http://localhost:3000"  # Should be accessible
}
```

**5. For SSE transport servers**
```bash
# Test SSE endpoint
curl -I https://mcp.linear.app/sse

# Verify network connectivity
curl --compressed https://mcp.linear.app/sse \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**6. Check environment variables**
```bash
# If MCP server needs env vars
cat .ax/settings.json | grep -A5 '"env"'

# Verify they're set correctly
echo $GITHUB_TOKEN
echo $LINEAR_API_KEY
```

---

### Problem: MCP server timeout

**Symptoms:**
```
Error: MCP server timed out
Error: Server did not respond in time
Timeout waiting for server response
```

**Solutions:**

**1. Increase timeout value**
```bash
# In .ax/settings.json
{
  "mcpServers": {
    "github": {
      "transport": "stdio",
      "timeout": 60000  # 60 seconds
    }
  }
}
```

**2. Check server performance**
```bash
# Monitor server startup time
time npx @modelcontextprotocol/server-github --help

# If slow, server initialization might be the issue
```

**3. Reduce operation complexity**
```bash
# MCP operations with smaller inputs
ax-cli mcp test github --timeout 30000
```

**4. For local servers, check system resources**
```bash
# Monitor CPU/Memory
top -n 1 | head -20

# Check disk space
df -h

# Restart system if needed
```

---

### Problem: MCP server authentication fails

**Symptoms:**
```
Error: 401 Unauthorized - GitHub
Error: Authentication failed for Linear
```

**Solutions:**

**1. Verify authentication token**
```bash
# Check token is set correctly
echo $GITHUB_TOKEN | head -c 20  # Show first 20 chars

# Should not be empty or "undefined"
if [ -z "$GITHUB_TOKEN" ]; then echo "Token not set"; fi
```

**2. Regenerate authentication token**

For **GitHub**:
```bash
# Generate new token at https://github.com/settings/tokens
# Select scopes: repo, read:org, gist
# Copy token and set: export GITHUB_TOKEN="ghp_..."
```

For **Linear**:
```bash
# Generate at https://linear.app/settings/api
# Copy token and set: export LINEAR_API_KEY="lin_api_..."
```

**3. Update .ax/settings.json**
```bash
# Edit configuration with new token
{
  "mcpServers": {
    "github": {
      "env": {
        "GITHUB_TOKEN": "ghp_your_new_token"
      }
    }
  }
}
```

**4. Set permissions for token**
```bash
# Ensure file has restrictive permissions
chmod 600 .ax/settings.json
chmod 700 .ax
```

---

### Problem: MCP tools not available or discovered

**Symptoms:**
```
Error: Tool not found
Error: No tools discovered from server
```

**Solutions:**

**1. Verify MCP server is active**
```bash
# List all MCP servers
ax-cli mcp list

# Check which server has the tool
ax-cli mcp info github | grep -A20 '"tools"'
```

**2. Test server tools**
```bash
# See available tools from server
ax-cli mcp test github --list-tools

# Try using specific tool
ax-cli mcp test github --tool "github_search"
```

**3. Check tool naming**
```bash
# Tools have snake_case names in MCP
# Examples: github_create_issue, linear_get_issues

# Not camelCase like: githubCreateIssue
```

**4. Reinitialize MCP servers**
```bash
# Remove and re-add server
ax-cli mcp remove github
ax-cli mcp add github \
  --transport stdio \
  --command "npx" \
  --args "@modelcontextprotocol/server-github" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN"
```

---

## Performance Issues

### Problem: AX CLI is slow or unresponsive

**Symptoms:**
```
Taking too long to respond
Hanging on initialization
Slow response times
```

**Solutions:**

**1. Reduce tool rounds limit**
```bash
# Default is 400, which can slow down response
ax-cli -p "test" --max-tool-rounds 10

# Or set in environment
export AI_MAX_TOOL_ROUNDS=10
```

**2. Use faster model**
```bash
# grok-code-fast-1 is faster than glm-4.6
ax-cli --model grok-code-fast-1 -p "test"
```

**3. Reduce context window**
```bash
# Large files slow down processing
# Limit input size:
ax-cli -p "analyze first 1000 lines of main.ts"
```

**4. Disable MCP servers you're not using**
```bash
# Remove unused MCP servers
ax-cli mcp remove unused-server

# Or comment out in .ax/settings.json
{
  "mcpServers": {
    "github": { "transport": "..." },
    // "linear": { "disabled": true }
  }
}
```

**5. Clear caches**
```bash
# Token counter cache
rm -rf ~/.ax/cache

# Node modules cache
npm cache clean --force

# Rebuild
npm run build
```

**6. Monitor system resources**
```bash
# Check available memory
free -h

# Check CPU usage
top -b -n 1 | head -20

# If system is slow, restart services
```

---

### Problem: High memory usage

**Symptoms:**
```
Process memory usage: 500MB+
System becomes sluggish
Memory leak suspected
```

**Solutions:**

**1. Limit token buffer**
```bash
# In .ax/settings.json
{
  "maxTokens": 4096,  # Reduce from default
  "cacheSize": 500    # Reduce cache size
}
```

**2. Process files in chunks**
```bash
# Split large files
split -l 1000 large-file.txt file-chunk-

# Process each chunk separately
for file in file-chunk-*; do
  ax-cli -p "analyze $file"
done
```

**3. Clear token counter cache**
```bash
# Cache can grow large
rm -rf ~/.ax/cache/token-cache*
```

**4. Use lighter model**
```bash
# Lighter models use less memory
ax-cli --model grok-code-fast-1 -p "test"
```

**5. Restart Node process**
```bash
# If memory keeps growing
killall node
ax-cli  # Fresh start
```

---

### Problem: Slow file operations

**Symptoms:**
```
File reading is slow
Search taking too long
Directory traversal is slow
```

**Solutions:**

**1. Use ripgrep for search**
```bash
# ripgrep is much faster than find/grep
rg "pattern" --type ts

# AX CLI uses ripgrep internally, but verify:
which rg
```

**2. Exclude large directories**
```bash
# Add to .ax/settings.json
{
  "excludePatterns": [
    "node_modules",
    ".git",
    "dist",
    "build"
  ]
}
```

**3. Limit file size**
```bash
# Default max file size: 1MB
# For larger files, use external tools first:
head -1000 large-file.txt | ax-cli analyze
```

**4. Use persistent cache**
```bash
# Directory cache in .ax/
# Automatically managed, but can be cleared:
rm -rf .ax/index.json

# Rebuild on next run
ax-cli init
```

---

## Configuration Errors

### Problem: Configuration file not found or not loading

**Symptoms:**
```
Warning: Configuration file not found
Settings not being applied
Using defaults instead of config
```

**Solutions:**

**1. Verify file paths**
```bash
# User settings
ls -la ~/.ax/user-settings.json

# Project settings
ls -la .ax/settings.json

# Create if missing
mkdir -p ~/.ax
touch ~/.ax/user-settings.json
```

**2. Check file permissions**
```bash
# Should be readable
ls -la ~/.ax/user-settings.json
# Should show: -rw-r--r-- or -rw-------

# Fix permissions if needed
chmod 644 ~/.ax/user-settings.json
```

**3. Validate JSON syntax**
```bash
# Use Python to validate
python -m json.tool ~/.ax/user-settings.json

# Or use jq
jq empty ~/.ax/user-settings.json

# Should output nothing if valid
# If error, fix JSON syntax
```

**4. Check for legacy .grok directory**
```bash
# Legacy path (auto-migrated)
ls -la ~/.grok/user-settings.json
ls -la .grok/settings.json

# These should auto-migrate, but can manually copy:
mkdir -p ~/.ax
cp ~/.grok/user-settings.json ~/.ax/user-settings.json
```

---

### Problem: Invalid configuration format

**Symptoms:**
```
Error: Configuration validation failed
Error: Invalid property value
Zod validation error
```

**Solutions:**

**1. Fix JSON syntax errors**
```bash
# Common issues:
# - Trailing commas: { "key": "value", }  ❌
# - Missing quotes: { key: "value" }      ❌
# - Unclosed braces: { "key": "value"     ❌

# Valid format:
{
  "apiKey": "key",
  "baseURL": "url",
  "defaultModel": "model"
}
```

**2. Validate property types**
```bash
# CORRECT property types:
{
  "apiKey": "string",           // String
  "defaultModel": "string",     // String
  "temperature": 0.7,           // Number
  "maxTokens": 4096,            // Number
  "models": ["model1"],         // Array of strings
  "mcpServers": {}              // Object
}

# INCORRECT:
{
  "temperature": "0.7",         // Should be number, not string
  "maxTokens": "4096",          // Should be number, not string
  "models": "model1"            // Should be array, not string
}
```

**3. Check required fields**
```bash
# Minimal valid config:
{
  "apiKey": "your_key",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1"
}

# Or for local Ollama:
{
  "baseURL": "http://localhost:11434/v1",
  "defaultModel": "glm4:9b"
}
```

**4. Use online JSON validator**
```bash
# Copy config to https://jsonlint.com
# Will show exact error location and suggestion
```

---

### Problem: Model configuration mismatch

**Symptoms:**
```
Error: Temperature out of range for model
Error: Max tokens exceeds model limit
Invalid temperature value
```

**Solutions:**

**1. Check model's valid ranges**
```bash
# Different models have different ranges
# glm-4.6: temperature 0.6-1.0
# grok-code-fast-1: temperature 0.0-2.0

# View in constants.ts for details
cat src/constants.ts | grep -A10 "GLM_MODELS"
```

**2. Fix configuration values**
```bash
# Example: glm-4.6
{
  "model": "glm-4.6",
  "temperature": 0.7,    // Range: 0.6-1.0 ✓
  "maxTokens": 8192      // Max: 128,000 ✓
}

# Example: grok-code-fast-1
{
  "model": "grok-code-fast-1",
  "temperature": 0.7,    // Range: 0.0-2.0 ✓
  "maxTokens": 4096      // Max: 4,096 ✓
}
```

**3. Adjust for model compatibility**
```bash
# If switching models, verify settings
ax-cli --model grok-code-fast-1 \
       --temperature 1.5 \
       --max-tokens 2048
```

---

## Common Error Messages

### "ENOENT: no such file or directory"

**Causes:**
- File or directory doesn't exist
- Path is incorrect or has typo
- Directory wasn't created yet

**Solutions:**
```bash
# Create missing directory
mkdir -p .ax

# Create missing file
touch .ax/settings.json

# Verify path exists
ls -la path/to/file

# Use full absolute paths
ax-cli --config "$HOME/.ax/user-settings.json"
```

---

### "EACCES: permission denied"

**Causes:**
- No read/write permission on file
- Running without required privileges
- File permissions too restrictive

**Solutions:**
```bash
# Check permissions
ls -la ~/.ax/user-settings.json

# Fix permissions
chmod 644 ~/.ax/user-settings.json    # rw-r--r--
chmod 755 ~/.ax                       # rwxr-xr-x

# Or use current user ownership
sudo chown -R $(whoami) ~/.ax
```

---

### "TypeError: Cannot read property 'X' of undefined"

**Causes:**
- Configuration missing required field
- Variable not initialized
- API response invalid format

**Solutions:**
```bash
# Ensure configuration is complete
cat ~/.ax/user-settings.json

# Add missing fields
{
  "apiKey": "required",
  "baseURL": "required",
  "defaultModel": "optional"
}

# Enable debug mode for more info
DEBUG=1 ax-cli -p "test"
```

---

### "ECONNREFUSED" or "ECONNRESET"

**Causes:**
- API server is down
- Localhost service not running
- Network connectivity issue
- Wrong port number

**Solutions:**
```bash
# Test connection
curl -I https://api.x.ai/v1

# For Ollama
curl -I http://localhost:11434/v1

# Check if service is running
ps aux | grep ollama
ps aux | grep node

# Restart service if needed
ollama serve  # In separate terminal
```

---

### "Zod validation error" or "Validation failed"

**Causes:**
- Configuration data type mismatch
- Invalid value for field
- Schema validation failed

**Solutions:**
```bash
# Check data types
cat ~/.ax/user-settings.json

# Verify field types match schema
# String fields: "value" (with quotes)
# Number fields: 123 (without quotes)
# Boolean fields: true or false (lowercase)

# Use JSON validator
python -m json.tool ~/.ax/user-settings.json

# Check against schema in src/schemas/
```

---

### "Error: Socket hang up" or "ESOCKETTIMEDOUT"

**Causes:**
- Server closed connection unexpectedly
- Request timeout too short
- Server is overloaded

**Solutions:**
```bash
# Increase timeout
AI_TIMEOUT=60000 ax-cli -p "test"

# Or in config
{
  "timeout": 60000
}

# Retry with backoff
for i in {1..3}; do
  ax-cli -p "test" && break
  sleep $((i * 2))
done
```

---

## Debug Mode and Logging

### Enable debug logging

**Method 1: Environment variable**
```bash
# Enable debug output
DEBUG=1 ax-cli -p "test prompt"

# More verbose
DEBUG=* ax-cli -p "test"

# Specific module
DEBUG=ax-cli:* ax-cli -p "test"
```

**Method 2: Configuration file**
```bash
# Add to ~/.ax/user-settings.json
{
  "debug": true,
  "logLevel": "debug"
}
```

---

### Capture detailed logs

**Method 1: Redirect to file**
```bash
# Capture all output
ax-cli -p "test" > ax-cli.log 2>&1

# View logs
cat ax-cli.log
tail -f ax-cli.log  # Real-time
```

**Method 2: With debug enabled**
```bash
# Full debugging
DEBUG=1 ax-cli -p "test" > ax-cli-debug.log 2>&1

# Search for errors
grep -i error ax-cli-debug.log
```

---

### Test specific features

**Test API connection**
```bash
# Minimal test
ax-cli -p "say hello"

# With specific model
ax-cli --model glm-4.6 -p "test"

# With verbose output
DEBUG=1 ax-cli -p "test"
```

**Test MCP servers**
```bash
# List servers
ax-cli mcp list

# Test specific server
ax-cli mcp test github

# Get server info
ax-cli mcp info github
```

**Test file operations**
```bash
# Create test file
echo "test content" > test.txt

# Test reading
ax-cli read test.txt

# Test editing
ax-cli edit test.txt "replace content"
```

---

### Common debug patterns

**Check environment variables**
```bash
# See all relevant vars
env | grep GROK
env | grep DEBUG

# See specific var
echo $YOUR_API_KEY
echo $AI_BASE_URL
```

**Trace execution flow**
```bash
# With strace (Linux)
strace -e openat,connect ax-cli -p "test" 2>&1 | head -50

# With dtrace (macOS)
# Requires additional setup
```

**Monitor network requests**
```bash
# Install tcpdump (if needed)
# Monitor HTTP requests
tcpdump -i any 'tcp port 443' -A

# Or use curl proxy
https_proxy=http://127.0.0.1:8080 ax-cli -p "test"
```

---

## Getting Help

### Before reaching out

**1. Check documentation**
- [Main README](../README.md)
- [Configuration Guide](./configuration.md)
- [MCP Integration Guide](./mcp-integration-guide.md)
- [CLI Reference](./cli-reference.md)

**2. Search existing issues**
```bash
# GitHub issues
# https://github.com/defai-digital/ax-cli/issues

# Search for your error message
# Check if already reported
```

**3. Try the solutions above**
- Follow troubleshooting steps in order
- Test each solution independently
- Note what works and what doesn't

---

### How to report a bug effectively

**Include this information:**

1. **Environment**
   ```bash
   node --version
   npm --version
   ax-cli --version
   uname -a  # System info
   ```

2. **Configuration** (without API keys)
   ```bash
   cat ~/.ax/user-settings.json | grep -v apiKey
   cat .ax/settings.json
   ```

3. **Exact error message**
   ```bash
   # Copy full error text
   # Include any stack trace
   ```

4. **Steps to reproduce**
   ```bash
   # Exactly what command causes the issue
   ax-cli -p "test prompt"
   ```

5. **Debug logs**
   ```bash
   DEBUG=1 ax-cli -p "test" > debug.log 2>&1
   # Attach log file (without sensitive info)
   ```

---

### Where to get help

**1. GitHub Issues**
- https://github.com/defai-digital/ax-cli/issues
- Search before creating new issue
- Use issue template provided

**2. GitHub Discussions**
- https://github.com/defai-digital/ax-cli/discussions
- Ask questions and share experiences
- Community knowledge base

**3. Documentation**
- All docs in `/docs` directory
- Comprehensive guides for each feature
- Code examples for common tasks

**4. Stack Overflow**
- Tag: `ax-cli`
- Clear, minimal example
- Include error message

---

### Community support resources

**Official Resources:**
- **Repository**: https://github.com/defai-digital/ax-cli
- **Issues**: https://github.com/defai-digital/ax-cli/issues
- **Discussions**: https://github.com/defai-digital/ax-cli/discussions
- **npm**: https://www.npmjs.com/package/@defai.digital/ax-cli

**Related Projects:**
- **AutomatosX**: https://github.com/defai-digital/automatosx
- **MCP Protocol**: https://modelcontextprotocol.io
- **OpenAI SDK**: https://github.com/openai/node-sdk

**External Providers:**
- **X.AI (Grok)**: https://x.ai
- **Z.AI (GLM)**: https://platform.z.ai
- **OpenRouter**: https://openrouter.ai
- **Ollama**: https://ollama.ai

---

### Emergency troubleshooting

**Complete reset (destructive)**
```bash
# 1. Backup settings
cp -r ~/.ax ~/.ax-backup
cp -r .ax .ax-backup

# 2. Remove everything
rm -rf node_modules package-lock.json dist
rm -rf ~/.ax .ax

# 3. Reinstall
npm install -g @defai.digital/ax-cli

# 4. Reconfigure
mkdir -p ~/.ax
cat > ~/.ax/user-settings.json <<'EOF'
{
  "apiKey": "your_key",
  "baseURL": "https://api.x.ai/v1",
  "defaultModel": "grok-code-fast-1"
}
EOF

# 5. Test
ax-cli -p "test"
```

**Reinstall from source**
```bash
# Clone repo
git clone https://github.com/defai-digital/ax-cli.git
cd ax-cli

# Install and build
npm install
npm run build

# Test
npm start -- -p "test"

# Link globally
npm link
```

---

<p align="center">
  <strong>Comprehensive Troubleshooting Guide</strong><br>
  <em>For detailed solutions to common AX CLI issues</em>
</p>
