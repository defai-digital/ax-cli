/**
 * Diff Viewer Component
 * Displays side-by-side or inline diff view for code changes
 * Features:
 * - Side-by-side and inline diff modes
 * - Basic syntax highlighting
 * - Diff navigation (next/previous change)
 * - Character-level highlighting for modified lines
 */

class DiffViewer {
  constructor(container) {
    this.container = container;
    this.currentChangeIndex = -1;
    this.changeIndices = [];
    this.diffLines = [];
  }

  /**
   * Render a diff between old and new code
   * @param {string} oldCode - Original code
   * @param {string} newCode - Modified code
   * @param {string} fileName - File name (optional)
   * @param {string} mode - 'side-by-side' or 'inline'
   */
  render(oldCode, newCode, fileName = '', mode = 'side-by-side') {
    this.diffLines = this.computeDiff(oldCode, newCode);
    this.changeIndices = this.diffLines
      .map((line, idx) => ({ type: line.type, idx }))
      .filter(item => item.type !== 'unchanged')
      .map(item => item.idx);
    this.currentChangeIndex = this.changeIndices.length > 0 ? 0 : -1;

    // Detect language from file extension
    const language = this.detectLanguage(fileName);

    this.container.innerHTML = mode === 'side-by-side'
      ? this.renderSideBySide(this.diffLines, fileName, language)
      : this.renderInline(this.diffLines, fileName, language);

    // Attach navigation handlers
    this.attachNavigationHandlers();

    // Scroll to first change
    if (this.changeIndices.length > 0) {
      this.scrollToChange(0);
    }
  }

  /**
   * Detect language from file name for syntax highlighting
   */
  detectLanguage(fileName) {
    if (!fileName) return 'text';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const langMap = {
      'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
      'ts': 'typescript', 'tsx': 'typescript',
      'py': 'python', 'pyw': 'python',
      'rb': 'ruby',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'c': 'c', 'h': 'c',
      'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin', 'kts': 'kotlin',
      'scala': 'scala',
      'json': 'json',
      'yaml': 'yaml', 'yml': 'yaml',
      'xml': 'xml', 'html': 'html', 'htm': 'html',
      'css': 'css', 'scss': 'css', 'less': 'css',
      'sql': 'sql',
      'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
      'md': 'markdown', 'markdown': 'markdown',
    };
    return langMap[ext] || 'text';
  }

  /**
   * Apply basic syntax highlighting to code
   */
  highlightSyntax(code, language) {
    if (!code || language === 'text') return this.escapeHtml(code);

    let highlighted = this.escapeHtml(code);

    // Common patterns for most languages
    const patterns = this.getLanguagePatterns(language);

    // Apply patterns in order (order matters for overlapping patterns)
    patterns.forEach(({ pattern, className }) => {
      highlighted = highlighted.replace(pattern, (match, ...groups) => {
        // Handle capture groups if present
        if (groups.length > 0 && typeof groups[0] === 'string') {
          return `<span class="syntax-${className}">${match}</span>`;
        }
        return `<span class="syntax-${className}">${match}</span>`;
      });
    });

    return highlighted;
  }

  /**
   * Get syntax highlighting patterns for a language
   */
  getLanguagePatterns(language) {
    // Common keywords across languages
    const jsKeywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|new|this|super|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|null|undefined|true|false)\b/g;
    const pyKeywords = /\b(def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|assert|True|False|None|and|or|not|is|in)\b/g;
    const goKeywords = /\b(func|return|if|else|for|range|switch|case|break|continue|go|select|chan|defer|package|import|var|const|type|struct|interface|map|make|new|append|len|cap|copy|delete|true|false|nil|iota)\b/g;

    // String patterns (single and double quotes)
    const singleQuoteString = /&#39;[^&#39;]*&#39;/g;  // Escaped single quotes in HTML
    const doubleQuoteString = /&quot;[^&quot;]*&quot;|"[^"]*"/g;
    const templateString = /`[^`]*`/g;

    // Comment patterns
    const singleLineComment = /\/\/[^\n]*/g;
    const hashComment = /#[^\n]*/g;
    const multiLineComment = /\/\*[\s\S]*?\*\//g;

    // Number pattern
    const numbers = /\b(\d+\.?\d*([eE][+-]?\d+)?|0x[0-9a-fA-F]+)\b/g;

    switch (language) {
      case 'javascript':
      case 'typescript':
        return [
          { pattern: multiLineComment, className: 'comment' },
          { pattern: singleLineComment, className: 'comment' },
          { pattern: templateString, className: 'string' },
          { pattern: singleQuoteString, className: 'string' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: jsKeywords, className: 'keyword' },
          { pattern: numbers, className: 'number' },
        ];
      case 'python':
        return [
          { pattern: hashComment, className: 'comment' },
          { pattern: /&#39;&#39;&#39;[\s\S]*?&#39;&#39;&#39;|&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;/g, className: 'string' },
          { pattern: singleQuoteString, className: 'string' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: pyKeywords, className: 'keyword' },
          { pattern: numbers, className: 'number' },
        ];
      case 'go':
        return [
          { pattern: multiLineComment, className: 'comment' },
          { pattern: singleLineComment, className: 'comment' },
          { pattern: templateString, className: 'string' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: goKeywords, className: 'keyword' },
          { pattern: numbers, className: 'number' },
        ];
      case 'json':
        return [
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: /\b(true|false|null)\b/g, className: 'keyword' },
          { pattern: numbers, className: 'number' },
        ];
      case 'yaml':
        return [
          { pattern: hashComment, className: 'comment' },
          { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*:/gm, className: 'keyword' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: singleQuoteString, className: 'string' },
          { pattern: /\b(true|false|null|yes|no)\b/gi, className: 'keyword' },
        ];
      case 'bash':
        return [
          { pattern: hashComment, className: 'comment' },
          { pattern: /\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?/g, className: 'variable' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: singleQuoteString, className: 'string' },
          { pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|export|source|alias|echo|cd|ls|cat|grep|sed|awk)\b/g, className: 'keyword' },
        ];
      default:
        return [
          { pattern: multiLineComment, className: 'comment' },
          { pattern: singleLineComment, className: 'comment' },
          { pattern: hashComment, className: 'comment' },
          { pattern: doubleQuoteString, className: 'string' },
          { pattern: singleQuoteString, className: 'string' },
          { pattern: numbers, className: 'number' },
        ];
    }
  }

  /**
   * Compute line-by-line diff using LCS algorithm
   */
  computeDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    // Use simple line-by-line comparison with LCS for better accuracy
    const lcs = this.longestCommonSubsequence(oldLines, newLines);
    const diff = [];

    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
        // Check if new line also matches
        if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
          // Unchanged line
          diff.push({
            type: 'unchanged',
            old: oldLines[oldIdx],
            new: newLines[newIdx],
            oldLineNum: oldIdx + 1,
            newLineNum: newIdx + 1
          });
          oldIdx++;
          newIdx++;
          lcsIdx++;
        } else {
          // Line added before the common line
          diff.push({
            type: 'add',
            old: '',
            new: newLines[newIdx],
            oldLineNum: null,
            newLineNum: newIdx + 1
          });
          newIdx++;
        }
      } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        // Line removed
        diff.push({
          type: 'remove',
          old: oldLines[oldIdx],
          new: '',
          oldLineNum: oldIdx + 1,
          newLineNum: null
        });
        oldIdx++;
      } else if (oldIdx < oldLines.length && newIdx < newLines.length) {
        // Both lines exist but don't match - could be modification or add+remove
        if (this.areSimilar(oldLines[oldIdx], newLines[newIdx])) {
          // Similar enough to be a modification
          diff.push({
            type: 'modify',
            old: oldLines[oldIdx],
            new: newLines[newIdx],
            oldLineNum: oldIdx + 1,
            newLineNum: newIdx + 1
          });
          oldIdx++;
          newIdx++;
        } else {
          // Too different - treat as remove then add
          diff.push({
            type: 'remove',
            old: oldLines[oldIdx],
            new: '',
            oldLineNum: oldIdx + 1,
            newLineNum: null
          });
          oldIdx++;
        }
      } else if (oldIdx < oldLines.length) {
        // Remaining old lines are removed
        diff.push({
          type: 'remove',
          old: oldLines[oldIdx],
          new: '',
          oldLineNum: oldIdx + 1,
          newLineNum: null
        });
        oldIdx++;
      } else if (newIdx < newLines.length) {
        // Remaining new lines are added
        diff.push({
          type: 'add',
          old: '',
          new: newLines[newIdx],
          oldLineNum: null,
          newLineNum: newIdx + 1
        });
        newIdx++;
      }
    }

    return diff;
  }

  /**
   * Compute longest common subsequence of lines
   */
  longestCommonSubsequence(arr1, arr2) {
    const m = arr1.length;
    const n = arr2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find LCS
    const lcs = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (arr1[i - 1] === arr2[j - 1]) {
        lcs.unshift(arr1[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  /**
   * Check if two lines are similar enough to be considered a modification
   */
  areSimilar(line1, line2) {
    if (!line1 || !line2) return false;
    const maxLen = Math.max(line1.length, line2.length);
    if (maxLen === 0) return true;

    // Count matching characters
    let matches = 0;
    const len1 = line1.length;
    const len2 = line2.length;
    const minLen = Math.min(len1, len2);

    for (let i = 0; i < minLen; i++) {
      if (line1[i] === line2[i]) matches++;
    }

    // Consider similar if more than 40% of characters match
    return matches / maxLen > 0.4;
  }

  /**
   * Highlight character-level differences in modified lines
   */
  highlightCharDiff(oldText, newText, isOld = true) {
    if (!oldText && !newText) return '';

    const highlighted = this.escapeHtml(isOld ? oldText : newText);

    // For now, return the escaped text
    // Character-level diff can be added later with more complex logic
    return highlighted;
  }

  renderSideBySide(diffLines, fileName, language) {
    const changeCount = diffLines.filter(l => l.type !== 'unchanged').length;
    const additions = diffLines.filter(l => l.type === 'add').length;
    const deletions = diffLines.filter(l => l.type === 'remove').length;
    const modifications = diffLines.filter(l => l.type === 'modify').length;

    return `
      <div class="diff-viewer side-by-side">
        <div class="diff-header">
          <span class="diff-filename">${this.escapeHtml(fileName || 'Untitled')}</span>
          <span class="diff-stats">
            <span class="stat-add">+${additions + modifications}</span>
            <span class="stat-remove">-${deletions + modifications}</span>
          </span>
        </div>
        <div class="diff-navigation">
          <button class="nav-btn" id="prevChange" title="Previous change (↑)">
            <span class="codicon codicon-arrow-up"></span>
          </button>
          <span class="nav-info">
            <span id="currentChange">0</span> / <span id="totalChanges">${changeCount}</span> changes
          </span>
          <button class="nav-btn" id="nextChange" title="Next change (↓)">
            <span class="codicon codicon-arrow-down"></span>
          </button>
        </div>
        <div class="diff-container">
          <div class="diff-pane">
            <div class="diff-pane-header">Original</div>
            <div class="diff-pane-content" id="oldPane">
              ${diffLines.map((line, idx) => this.renderOldLine(line, idx, language)).join('')}
            </div>
          </div>
          <div class="diff-pane">
            <div class="diff-pane-header">Modified</div>
            <div class="diff-pane-content" id="newPane">
              ${diffLines.map((line, idx) => this.renderNewLine(line, idx, language)).join('')}
            </div>
          </div>
        </div>
        <div class="diff-actions">
          <button class="diff-action-btn" onclick="acceptDiff()">
            <span class="codicon codicon-check"></span> Accept Changes
          </button>
          <button class="diff-action-btn secondary" onclick="rejectDiff()">
            <span class="codicon codicon-close"></span> Reject
          </button>
          <button class="diff-action-btn secondary" onclick="showInEditor()">
            <span class="codicon codicon-go-to-file"></span> View in Editor
          </button>
        </div>
      </div>
    `;
  }

  renderInline(diffLines, fileName, language) {
    const changeCount = diffLines.filter(l => l.type !== 'unchanged').length;
    const additions = diffLines.filter(l => l.type === 'add').length;
    const deletions = diffLines.filter(l => l.type === 'remove').length;
    const modifications = diffLines.filter(l => l.type === 'modify').length;

    return `
      <div class="diff-viewer inline">
        <div class="diff-header">
          <span class="diff-filename">${this.escapeHtml(fileName || 'Untitled')}</span>
          <span class="diff-stats">
            <span class="stat-add">+${additions + modifications}</span>
            <span class="stat-remove">-${deletions + modifications}</span>
          </span>
        </div>
        <div class="diff-navigation">
          <button class="nav-btn" id="prevChange" title="Previous change (↑)">
            <span class="codicon codicon-arrow-up"></span>
          </button>
          <span class="nav-info">
            <span id="currentChange">0</span> / <span id="totalChanges">${changeCount}</span> changes
          </span>
          <button class="nav-btn" id="nextChange" title="Next change (↓)">
            <span class="codicon codicon-arrow-down"></span>
          </button>
        </div>
        <div class="diff-content" id="diffContent">
          ${diffLines.map((line, idx) => this.renderInlineLine(line, idx, language)).join('')}
        </div>
        <div class="diff-actions">
          <button class="diff-action-btn" onclick="acceptDiff()">
            <span class="codicon codicon-check"></span> Accept Changes
          </button>
          <button class="diff-action-btn secondary" onclick="rejectDiff()">
            <span class="codicon codicon-close"></span> Reject
          </button>
          <button class="diff-action-btn secondary" onclick="showInEditor()">
            <span class="codicon codicon-go-to-file"></span> View in Editor
          </button>
        </div>
      </div>
    `;
  }

  renderOldLine(line, idx, language) {
    const className = this.getLineClass(line.type, 'old');
    const lineNum = line.oldLineNum || '';
    const content = line.type === 'add'
      ? ''
      : this.highlightSyntax(line.old || '', language);

    return `
      <div class="diff-line ${className}" data-line="${idx}" data-type="${line.type}">
        <span class="line-num">${lineNum}</span>
        <span class="line-marker">${line.type === 'remove' || line.type === 'modify' ? '-' : ' '}</span>
        <span class="line-content">${content}</span>
      </div>
    `;
  }

  renderNewLine(line, idx, language) {
    const className = this.getLineClass(line.type, 'new');
    const lineNum = line.newLineNum || '';
    const content = line.type === 'remove'
      ? ''
      : this.highlightSyntax(line.new || '', language);

    return `
      <div class="diff-line ${className}" data-line="${idx}" data-type="${line.type}">
        <span class="line-num">${lineNum}</span>
        <span class="line-marker">${line.type === 'add' || line.type === 'modify' ? '+' : ' '}</span>
        <span class="line-content">${content}</span>
      </div>
    `;
  }

  renderInlineLine(line, idx, language) {
    const className = this.getLineClass(line.type, 'inline');

    if (line.type === 'modify') {
      // For modifications, show both old and new lines
      return `
        <div class="diff-line diff-remove" data-line="${idx}" data-type="modify-old">
          <span class="line-num">${line.oldLineNum || ''}</span>
          <span class="line-marker">-</span>
          <span class="line-content">${this.highlightSyntax(line.old, language)}</span>
        </div>
        <div class="diff-line diff-add" data-line="${idx}" data-type="modify-new">
          <span class="line-num">${line.newLineNum || ''}</span>
          <span class="line-marker">+</span>
          <span class="line-content">${this.highlightSyntax(line.new, language)}</span>
        </div>
      `;
    }

    const lineNum = line.type === 'remove' ? line.oldLineNum : line.newLineNum;
    const content = line.type === 'remove' ? line.old : line.new;
    const marker = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

    return `
      <div class="diff-line ${className}" data-line="${idx}" data-type="${line.type}">
        <span class="line-num">${lineNum || ''}</span>
        <span class="line-marker">${marker}</span>
        <span class="line-content">${this.highlightSyntax(content || '', language)}</span>
      </div>
    `;
  }

  getLineClass(type, mode) {
    const classes = [];

    if (type === 'add') classes.push('diff-add');
    else if (type === 'remove') classes.push('diff-remove');
    else if (type === 'modify') classes.push('diff-modify');

    if (mode === 'old' && type === 'add') classes.push('diff-empty');
    if (mode === 'new' && type === 'remove') classes.push('diff-empty');

    return classes.join(' ');
  }

  /**
   * Attach navigation event handlers
   */
  attachNavigationHandlers() {
    const prevBtn = document.getElementById('prevChange');
    const nextBtn = document.getElementById('nextChange');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigateToPreviousChange());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigateToNextChange());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.navigateToPreviousChange();
      } else if (e.key === 'ArrowDown' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.navigateToNextChange();
      }
    });

    // Update initial counter
    this.updateNavigationCounter();
  }

  /**
   * Navigate to previous change
   */
  navigateToPreviousChange() {
    if (this.changeIndices.length === 0) return;

    this.currentChangeIndex--;
    if (this.currentChangeIndex < 0) {
      this.currentChangeIndex = this.changeIndices.length - 1;
    }

    this.scrollToChange(this.changeIndices[this.currentChangeIndex]);
    this.updateNavigationCounter();
  }

  /**
   * Navigate to next change
   */
  navigateToNextChange() {
    if (this.changeIndices.length === 0) return;

    this.currentChangeIndex++;
    if (this.currentChangeIndex >= this.changeIndices.length) {
      this.currentChangeIndex = 0;
    }

    this.scrollToChange(this.changeIndices[this.currentChangeIndex]);
    this.updateNavigationCounter();
  }

  /**
   * Scroll to a specific change
   */
  scrollToChange(lineIndex) {
    // Remove highlight from all lines
    const allLines = this.container.querySelectorAll('.diff-line');
    allLines.forEach(line => line.classList.remove('current-change'));

    // Find and highlight the target line(s)
    const targetLines = this.container.querySelectorAll(`[data-line="${lineIndex}"]`);
    targetLines.forEach(line => {
      line.classList.add('current-change');
      line.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /**
   * Update navigation counter display
   */
  updateNavigationCounter() {
    const currentEl = document.getElementById('currentChange');
    if (currentEl) {
      currentEl.textContent = this.changeIndices.length > 0 ? this.currentChangeIndex + 1 : 0;
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiffViewer;
}
