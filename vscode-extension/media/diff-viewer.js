/**
 * Diff Viewer Component
 * Displays side-by-side or inline diff view for code changes
 */

class DiffViewer {
  constructor(container) {
    this.container = container;
  }

  /**
   * Render a diff between old and new code
   * @param {string} oldCode - Original code
   * @param {string} newCode - Modified code
   * @param {string} fileName - File name (optional)
   * @param {string} mode - 'side-by-side' or 'inline'
   */
  render(oldCode, newCode, fileName = '', mode = 'side-by-side') {
    const diffLines = this.computeDiff(oldCode, newCode);

    this.container.innerHTML = mode === 'side-by-side'
      ? this.renderSideBySide(diffLines, fileName)
      : this.renderInline(diffLines, fileName);
  }

  /**
   * Compute line-by-line diff
   * Simple implementation - can be enhanced with proper diff algorithm
   */
  computeDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff = [];

    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        // Added line
        diff.push({ type: 'add', old: '', new: newLine, lineNum: i + 1 });
      } else if (newLine === undefined) {
        // Removed line
        diff.push({ type: 'remove', old: oldLine, new: '', lineNum: i + 1 });
      } else if (oldLine !== newLine) {
        // Modified line
        diff.push({ type: 'modify', old: oldLine, new: newLine, lineNum: i + 1 });
      } else {
        // Unchanged line
        diff.push({ type: 'unchanged', old: oldLine, new: newLine, lineNum: i + 1 });
      }
    }

    return diff;
  }

  renderSideBySide(diffLines, fileName) {
    return `
      <div class="diff-viewer side-by-side">
        ${fileName ? `<div class="diff-header">${this.escapeHtml(fileName)}</div>` : ''}
        <div class="diff-container">
          <div class="diff-pane">
            <div class="diff-pane-header">Original</div>
            <div class="diff-pane-content">
              ${diffLines.map((line, idx) => this.renderOldLine(line, idx)).join('')}
            </div>
          </div>
          <div class="diff-pane">
            <div class="diff-pane-header">Modified</div>
            <div class="diff-pane-content">
              ${diffLines.map((line, idx) => this.renderNewLine(line, idx)).join('')}
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
        </div>
      </div>
    `;
  }

  renderInline(diffLines, fileName) {
    return `
      <div class="diff-viewer inline">
        ${fileName ? `<div class="diff-header">${this.escapeHtml(fileName)}</div>` : ''}
        <div class="diff-content">
          ${diffLines.map((line, idx) => this.renderInlineLine(line, idx)).join('')}
        </div>
        <div class="diff-actions">
          <button class="diff-action-btn" onclick="acceptDiff()">
            <span class="codicon codicon-check"></span> Accept Changes
          </button>
          <button class="diff-action-btn secondary" onclick="rejectDiff()">
            <span class="codicon codicon-close"></span> Reject
          </button>
        </div>
      </div>
    `;
  }

  renderOldLine(line, idx) {
    const className = this.getLineClass(line.type, 'old');
    const lineNum = line.type !== 'add' ? line.lineNum : '';
    return `
      <div class="diff-line ${className}" data-line="${idx}">
        <span class="line-num">${lineNum}</span>
        <span class="line-content">${this.escapeHtml(line.old || '')}</span>
      </div>
    `;
  }

  renderNewLine(line, idx) {
    const className = this.getLineClass(line.type, 'new');
    const lineNum = line.type !== 'remove' ? line.lineNum : '';
    return `
      <div class="diff-line ${className}" data-line="${idx}">
        <span class="line-num">${lineNum}</span>
        <span class="line-content">${this.escapeHtml(line.new || '')}</span>
      </div>
    `;
  }

  renderInlineLine(line, idx) {
    const className = this.getLineClass(line.type, 'inline');
    let content = '';
    let lineNum = line.lineNum;

    if (line.type === 'remove') {
      content = `<span class="line-content removed">- ${this.escapeHtml(line.old)}</span>`;
    } else if (line.type === 'add') {
      content = `<span class="line-content added">+ ${this.escapeHtml(line.new)}</span>`;
    } else if (line.type === 'modify') {
      content = `
        <span class="line-content removed">- ${this.escapeHtml(line.old)}</span>
        <span class="line-content added">+ ${this.escapeHtml(line.new)}</span>
      `;
    } else {
      content = `<span class="line-content">&nbsp; ${this.escapeHtml(line.new)}</span>`;
    }

    return `
      <div class="diff-line ${className}" data-line="${idx}">
        <span class="line-num">${lineNum}</span>
        ${content}
      </div>
    `;
  }

  getLineClass(type, mode) {
    const classes = [];

    if (type === 'add') classes.push('diff-add');
    else if (type === 'remove') classes.push('diff-remove');
    else if (type === 'modify') classes.push('diff-modify');

    if (mode === 'old' && (type === 'add')) classes.push('diff-empty');
    if (mode === 'new' && (type === 'remove')) classes.push('diff-empty');

    return classes.join(' ');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiffViewer;
}
