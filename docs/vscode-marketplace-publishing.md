# Publishing AX CLI Extension to VSCode Marketplace

**Complete guide to publishing the AX CLI VSCode extension publicly**

---

## Prerequisites

### 1. Install VSCE (VSCode Extension Manager)

```bash
npm install -g @vscode/vsce
```

### 2. Create Microsoft Azure Account

You need an Azure DevOps account to publish extensions.

1. Go to https://azure.microsoft.com/services/devops/
2. Click "Start free"
3. Sign in with Microsoft account (or create one)
4. Create an Azure DevOps organization

### 3. Create Personal Access Token (PAT)

1. Go to https://dev.azure.com/[your-org]
2. Click your profile icon (top right) → "Personal access tokens"
3. Click "+ New Token"
4. Configure token:
   - **Name**: "VSCode Marketplace Publisher"
   - **Organization**: Select your org
   - **Expiration**: Custom (1 year recommended)
   - **Scopes**: Click "Show all scopes"
     - ✅ Check **"Marketplace"** → **"Manage"**
5. Click "Create"
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### 4. Create Publisher

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with same Microsoft account
3. Click "Create publisher"
4. Fill in:
   - **Publisher Name**: `defai-digital` (must match package.json)
   - **Display Name**: "Defai Digital"
   - **Description**: "AI-powered development tools"
   - **Email**: your@email.com
   - **Website**: https://github.com/defai-digital/ax-cli
5. Click "Create"

---

## Pre-Publishing Checklist

### 1. Verify Package.json

```bash
cd vscode-extension
cat package.json
```

Ensure these fields are correct:

```json
{
  "name": "ax-cli-vscode",
  "displayName": "AX CLI",
  "description": "AI-powered coding assistant with multi-provider flexibility",
  "version": "0.1.0",
  "publisher": "defai-digital",
  "icon": "resources/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/defai-digital/ax-cli"
  },
  "bugs": {
    "url": "https://github.com/defai-digital/ax-cli/issues"
  },
  "homepage": "https://github.com/defai-digital/ax-cli#readme",
  "license": "MIT"
}
```

### 2. Verify Icon

```bash
# Icon should be 128x128 PNG
ls -lh resources/icon.png
```

✅ We have: `icon.png` (53KB) - Official AX logo

### 3. Test Extension Locally

```bash
# Install dependencies
npm install

# Build extension
npm run compile

# Run tests
npm test -- --run

# Package VSIX
vsce package
```

This creates: `ax-cli-vscode-0.1.0.vsix`

### 4. Install and Test VSIX

```bash
# Install locally
code --install-extension ax-cli-vscode-0.1.0.vsix

# Test in VSCode
# - Click AX icon in sidebar
# - Try commands
# - Verify everything works
```

---

## Publishing Steps

### Method 1: Using VSCE CLI (Recommended)

#### Step 1: Login to Publisher

```bash
vsce login defai-digital
```

When prompted, paste your Personal Access Token (PAT).

#### Step 2: Publish Extension

```bash
# From vscode-extension directory
cd vscode-extension

# Publish (this will build and publish)
vsce publish
```

Or specify version bump:

```bash
# Patch version (0.1.0 → 0.1.1)
vsce publish patch

# Minor version (0.1.0 → 0.2.0)
vsce publish minor

# Major version (0.1.0 → 1.0.0)
vsce publish major
```

#### Step 3: Verify Publication

1. Go to https://marketplace.visualstudio.com/items?itemName=defai-digital.ax-cli-vscode
2. Extension should be live within 5-10 minutes
3. Search for "AX CLI" in VSCode Extensions

---

### Method 2: Manual Upload (Alternative)

If VSCE CLI doesn't work, you can upload manually:

1. Package extension:
   ```bash
   vsce package
   ```

2. Go to https://marketplace.visualstudio.com/manage/publishers/defai-digital

3. Click "+ New extension"

4. Drag and drop `ax-cli-vscode-0.1.0.vsix`

5. Click "Upload"

---

## Post-Publishing

### 1. Verify Extension is Live

```bash
# Search in VSCode
# Cmd+Shift+X → Search "AX CLI"

# Or install from command line
code --install-extension defai-digital.ax-cli-vscode
```

### 2. Update Documentation

Add marketplace badge to README.md:

```markdown
[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/defai-digital.ax-cli-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=defai-digital.ax-cli-vscode)
[![Installs](https://img.shields.io/vscode-marketplace/i/defai-digital.ax-cli-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=defai-digital.ax-cli-vscode)
[![Rating](https://img.shields.io/vscode-marketplace/r/defai-digital.ax-cli-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=defai-digital.ax-cli-vscode)
```

### 3. Announce Release

- Tweet/post on social media
- Update main README.md
- Add to GitHub releases
- Notify Discord/Slack communities

---

## Updating Published Extension

### For Bug Fixes (Patch)

```bash
# 1. Fix bugs
# 2. Update vscode-extension/CHANGELOG.md
# 3. Bump version and publish
vsce publish patch
```

### For New Features (Minor)

```bash
# 1. Implement features
# 2. Update vscode-extension/CHANGELOG.md
# 3. Bump version and publish
vsce publish minor
```

### For Breaking Changes (Major)

```bash
# 1. Make breaking changes
# 2. Update vscode-extension/CHANGELOG.md with migration guide
# 3. Bump version and publish
vsce publish major
```

---

## Marketplace Best Practices

### 1. Extension Manifest (package.json)

**Required Fields:**
- ✅ `name` - Unique identifier
- ✅ `displayName` - User-friendly name
- ✅ `description` - Clear, concise description
- ✅ `version` - Semantic versioning
- ✅ `publisher` - Your publisher ID
- ✅ `icon` - 128x128 PNG
- ✅ `engines.vscode` - VSCode version
- ✅ `categories` - Relevant categories
- ✅ `keywords` - Searchable terms
- ✅ `repository` - GitHub URL
- ✅ `license` - License type

**Optional but Recommended:**
- ✅ `homepage` - Documentation
- ✅ `bugs` - Issue tracker
- ✅ `galleryBanner` - Marketplace banner
- ✅ `preview` - Beta flag (if applicable)

### 2. README.md

Include:
- ✅ Clear description
- ✅ Screenshots/GIFs
- ✅ Features list
- ✅ Installation instructions
- ✅ Usage examples
- ✅ Configuration guide
- ✅ Keyboard shortcuts
- ✅ Known issues
- ✅ License

### 3. vscode-extension/CHANGELOG.md

Maintain clear version history:
- ✅ Keep format consistent
- ✅ Use semantic versioning
- ✅ List all changes (added, fixed, changed, removed)
- ✅ Include dates

### 4. Screenshots/Media

Add to extension root:
```
vscode-extension/
├── images/
│   ├── screenshot-chat.png
│   ├── screenshot-diff.png
│   ├── demo.gif
```

Reference in README:
```markdown
![Chat Interface](images/screenshot-chat.png)
![Diff Viewer](images/screenshot-diff.png)
```

---

## Troubleshooting

### Issue: "Publisher not found"

**Solution:**
```bash
# Create publisher first at:
# https://marketplace.visualstudio.com/manage
```

### Issue: "PAT token invalid"

**Solution:**
```bash
# Create new PAT with "Marketplace > Manage" scope
vsce logout
vsce login defai-digital
```

### Issue: "Package size too large"

**Solution:**
```bash
# Check .vscodeignore is excluding correctly
cat .vscodeignore

# Verify package contents
vsce ls
```

### Issue: "Icon not showing"

**Solution:**
```bash
# Ensure icon is:
# - 128x128 pixels
# - PNG format
# - In resources/icon.png
# - Referenced in package.json
```

### Issue: "Extension not activating"

**Solution:**
```bash
# Check activation events in package.json
# Verify main entry point exists
ls -la dist/extension.js
```

---

## Marketplace Statistics

After publishing, monitor:

1. **Marketplace Dashboard**
   - https://marketplace.visualstudio.com/manage/publishers/defai-digital
   - View installs, ratings, reviews

2. **GitHub Integration**
   - Issues reported
   - Feature requests
   - Community engagement

3. **Analytics** (if enabled)
   - Daily active users
   - Command usage
   - Error rates

---

## Quick Reference Commands

```bash
# Install VSCE
npm install -g @vscode/vsce

# Login
vsce login defai-digital

# Package (without publishing)
vsce package

# Publish
vsce publish

# Publish with version bump
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0

# Unpublish (use carefully!)
vsce unpublish defai-digital.ax-cli-vscode

# Logout
vsce logout
```

---

## Pre-Launch Checklist

Before first publish:

- [ ] Azure DevOps account created
- [ ] Personal Access Token (PAT) created
- [ ] Publisher account created (defai-digital)
- [ ] Extension tested locally
- [ ] VSIX package created and tested
- [ ] README.md complete with screenshots
- [ ] vscode-extension/CHANGELOG.md up to date
- [ ] LICENSE file included
- [ ] Icon (128x128 PNG) included
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] .vscodeignore configured
- [ ] package.json fields verified
- [ ] GitHub repository public
- [ ] Version number appropriate (0.1.0 for beta)

---

## Publishing Timeline

1. **Setup** (30 min)
   - Create Azure account
   - Create PAT
   - Create publisher
   - Install VSCE

2. **Verification** (15 min)
   - Test extension locally
   - Review checklist
   - Verify package.json

3. **Package** (5 min)
   - Run `vsce package`
   - Test VSIX

4. **Publish** (5 min)
   - Run `vsce publish`
   - Wait for processing

5. **Verification** (10 min)
   - Check marketplace listing
   - Install from marketplace
   - Test installed version

**Total:** ~1 hour for first publish

---

## Support & Resources

- **VSCE Documentation**: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **Marketplace**: https://marketplace.visualstudio.com/vscode
- **Publisher Management**: https://marketplace.visualstudio.com/manage
- **Extension Guidelines**: https://code.visualstudio.com/api/references/extension-guidelines
- **Azure DevOps**: https://dev.azure.com

---

## Example: First Publish

```bash
# 1. Install VSCE
npm install -g @vscode/vsce

# 2. Navigate to extension
cd vscode-extension

# 3. Verify everything works
npm run compile
npm test -- --run

# 4. Login (will prompt for PAT)
vsce login defai-digital

# 5. Publish!
vsce publish

# Output:
# Publishing defai-digital.ax-cli-vscode@0.1.0...
# Successfully published defai-digital.ax-cli-vscode@0.1.0!
# Your extension will live at:
# https://marketplace.visualstudio.com/items?itemName=defai-digital.ax-cli-vscode
```

---

**Ready to publish? Follow the steps above!** 🚀
