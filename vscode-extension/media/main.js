(function() {
  const vscode = acquireVsCodeApi();

  // State - restore from VS Code state API for persistence
  const previousState = vscode.getState() || {};
  let messages = previousState.messages || [];
  let isLoading = false;
  let extendedThinking = previousState.extendedThinking || false;
  let mentionedFiles = [];
  let attachedImages = [];  // New: attached images
  let showingFilePicker = false;
  let filePickerQuery = '';

  // Slash commands
  const SLASH_COMMANDS = [
    { command: '/clear', description: 'Clear chat history' },
    { command: '/model', description: 'Change AI model' },
    { command: '/help', description: 'Show help' },
    { command: '/compact', description: 'Compact conversation' },
    { command: '/thinking', description: 'Toggle extended thinking' },
    { command: '/files', description: 'Add files to context' },
    { command: '/diff', description: 'Show git diff' },
    { command: '/image', description: 'Attach image' },
    { command: '/rewind', description: 'Rewind to checkpoint' },
    { command: '/session', description: 'Manage sessions' },
    { command: '/errors', description: 'Auto-fix errors' },
    { command: '/hooks', description: 'Manage hooks' },
  ];

  // Current session info
  let currentSession = null;

  // Initialize
  function init() {
    createUI();
    attachEventListeners();
    renderMessages();
    focusInput();
    updateThinkingButton();
  }

  function createUI() {
    document.body.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <h3>AX CLI Assistant</h3>
          <div class="header-actions">
            <button id="thinkingButton" class="icon-button" title="Toggle Extended Thinking">
              <span class="codicon codicon-lightbulb"></span>
            </button>
            <button id="clearButton" class="icon-button" title="Clear history">
              <span class="codicon codicon-clear-all"></span>
            </button>
          </div>
        </div>
        <div id="messages" class="messages-container"></div>
        <div class="input-wrapper">
          <div id="mentionedFilesContainer" class="mentioned-files"></div>
          <div id="attachedImagesContainer" class="attached-images"></div>
          <div id="autocompleteContainer" class="autocomplete-container" style="display: none;"></div>
          <div class="input-container">
            <textarea
              id="messageInput"
              class="message-input"
              placeholder="Ask me anything... (@ to mention files, / for commands)"
              rows="3"
            ></textarea>
            <div class="input-actions">
              <button id="attachButton" class="icon-button" title="Attach file (@)">
                <span class="codicon codicon-add"></span>
              </button>
              <button id="imageButton" class="icon-button" title="Attach image (Cmd+Alt+I)">
                <span class="codicon codicon-file-media"></span>
              </button>
              <button id="sendButton" class="send-button">
                <span class="codicon codicon-send"></span>
                Send
              </button>
            </div>
          </div>
          <div class="input-hints">
            <span class="hint"><kbd>@</kbd> files</span>
            <span class="hint"><kbd>/</kbd> commands</span>
            <span class="hint"><kbd>Cmd+Alt+K</kbd> picker</span>
            <span class="hint"><kbd>Ctrl+Enter</kbd> send</span>
          </div>
        </div>
      </div>
    `;
  }

  function attachEventListeners() {
    const input = document.getElementById('messageInput');
    const send = document.getElementById('sendButton');
    const clear = document.getElementById('clearButton');
    const thinking = document.getElementById('thinkingButton');
    const attach = document.getElementById('attachButton');
    const imageBtn = document.getElementById('imageButton');

    send.addEventListener('click', handleSend);
    clear.addEventListener('click', handleClear);
    thinking.addEventListener('click', toggleThinking);
    attach.addEventListener('click', () => triggerFilePicker());
    imageBtn.addEventListener('click', () => triggerImagePicker());

    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('input', handleInput);

    // Close autocomplete on click outside
    document.addEventListener('click', (e) => {
      const autocomplete = document.getElementById('autocompleteContainer');
      if (!autocomplete.contains(e.target) && e.target.id !== 'messageInput') {
        hideAutocomplete();
      }
    });
  }

  function handleKeydown(e) {
    const autocomplete = document.getElementById('autocompleteContainer');
    const isAutocompleteVisible = autocomplete.style.display !== 'none';

    if (isAutocompleteVisible) {
      const items = autocomplete.querySelectorAll('.autocomplete-item');
      const selected = autocomplete.querySelector('.autocomplete-item.selected');
      let selectedIndex = Array.from(items).indexOf(selected);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selected) selected.classList.remove('selected');
        selectedIndex = (selectedIndex + 1) % items.length;
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selected) selected.classList.remove('selected');
        selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (selected) {
          selectAutocompleteItem(selected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (selected) {
          selectAutocompleteItem(selected);
        }
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  }

  function handleInput(e) {
    const input = e.target;
    const value = input.value;
    const cursorPos = input.selectionStart;

    // Check for @ mention trigger
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);

    if (atMatch) {
      filePickerQuery = atMatch[1];
      showFilePicker(filePickerQuery);
      return;
    }

    // Check for / command trigger
    const slashMatch = textBeforeCursor.match(/^\/([^\s]*)$/);
    if (slashMatch && cursorPos === value.length) {
      showSlashCommands(slashMatch[1]);
      return;
    }

    hideAutocomplete();
  }

  function showFilePicker(query) {
    showingFilePicker = true;
    vscode.postMessage({
      type: 'requestFiles',
      query: query
    });
  }

  function showSlashCommands(query) {
    const filtered = SLASH_COMMANDS.filter(cmd =>
      cmd.command.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
      hideAutocomplete();
      return;
    }

    const container = document.getElementById('autocompleteContainer');
    container.innerHTML = `
      <div class="autocomplete-header">Commands</div>
      ${filtered.map((cmd, i) => `
        <div class="autocomplete-item ${i === 0 ? 'selected' : ''}"
             data-type="command"
             data-value="${cmd.command}">
          <span class="autocomplete-icon codicon codicon-terminal"></span>
          <div class="autocomplete-text">
            <span class="autocomplete-name">${cmd.command}</span>
            <span class="autocomplete-desc">${cmd.description}</span>
          </div>
        </div>
      `).join('')}
    `;

    container.style.display = 'block';
    attachAutocompleteListeners();
  }

  function renderFilePicker(files) {
    if (!showingFilePicker) return;

    const container = document.getElementById('autocompleteContainer');

    if (!files || files.length === 0) {
      container.innerHTML = `
        <div class="autocomplete-header">Files</div>
        <div class="autocomplete-empty">No matching files found</div>
      `;
      container.style.display = 'block';
      return;
    }

    container.innerHTML = `
      <div class="autocomplete-header">Files (${files.length})</div>
      ${files.slice(0, 10).map((file, i) => `
        <div class="autocomplete-item ${i === 0 ? 'selected' : ''}"
             data-type="file"
             data-value="${escapeHtml(file.path)}"
             data-name="${escapeHtml(file.name)}">
          <span class="autocomplete-icon codicon codicon-file"></span>
          <div class="autocomplete-text">
            <span class="autocomplete-name">${escapeHtml(file.name)}</span>
            <span class="autocomplete-desc">${escapeHtml(file.relativePath)}</span>
          </div>
        </div>
      `).join('')}
      ${files.length > 10 ? `<div class="autocomplete-more">+${files.length - 10} more files...</div>` : ''}
    `;

    container.style.display = 'block';
    attachAutocompleteListeners();
  }

  function attachAutocompleteListeners() {
    const container = document.getElementById('autocompleteContainer');
    container.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => selectAutocompleteItem(item));
      item.addEventListener('mouseenter', () => {
        container.querySelectorAll('.autocomplete-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
  }

  function selectAutocompleteItem(item) {
    const type = item.dataset.type;
    const value = item.dataset.value;
    const input = document.getElementById('messageInput');

    if (type === 'file') {
      // Add file to mentioned files
      const fileName = item.dataset.name;
      addMentionedFile(value, fileName);

      // Remove @ trigger from input
      const cursorPos = input.selectionStart;
      const textBefore = input.value.substring(0, cursorPos);
      const textAfter = input.value.substring(cursorPos);
      const newTextBefore = textBefore.replace(/@[^\s@]*$/, '');
      input.value = newTextBefore + textAfter;
      input.selectionStart = input.selectionEnd = newTextBefore.length;
    } else if (type === 'command') {
      // Execute slash command
      executeSlashCommand(value);
      input.value = '';
    }

    hideAutocomplete();
    showingFilePicker = false;
    input.focus();
  }

  function addMentionedFile(path, name) {
    if (mentionedFiles.some(f => f.path === path)) return;

    mentionedFiles.push({ path, name });
    renderMentionedFiles();
  }

  function removeMentionedFile(path) {
    mentionedFiles = mentionedFiles.filter(f => f.path !== path);
    renderMentionedFiles();
  }

  function renderMentionedFiles() {
    const container = document.getElementById('mentionedFilesContainer');
    if (mentionedFiles.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = mentionedFiles.map((file, index) => `
      <div class="mentioned-file" data-path="${escapeHtml(file.path)}" data-index="${index}">
        <span class="codicon codicon-file"></span>
        <span class="file-name">${escapeHtml(file.name)}</span>
        <button class="remove-file" data-index="${index}">
          <span class="codicon codicon-close"></span>
        </button>
      </div>
    `).join('');

    // Add event listeners for remove buttons (safer than inline onclick)
    container.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index, 10);
        if (!isNaN(index) && mentionedFiles[index]) {
          removeMentionedFile(mentionedFiles[index].path);
        }
      });
    });
  }

  function hideAutocomplete() {
    const container = document.getElementById('autocompleteContainer');
    container.style.display = 'none';
    container.innerHTML = '';
    showingFilePicker = false;
  }

  function triggerFilePicker() {
    const input = document.getElementById('messageInput');
    const cursorPos = input.selectionStart;
    input.value = input.value.substring(0, cursorPos) + '@' + input.value.substring(cursorPos);
    input.selectionStart = input.selectionEnd = cursorPos + 1;
    input.focus();
    showFilePicker('');
  }

  function triggerImagePicker() {
    // Request image picker from extension
    vscode.postMessage({ type: 'requestImagePicker' });
  }

  function addAttachedImage(image) {
    if (attachedImages.some(i => i.path === image.path)) return;
    attachedImages.push(image);
    renderAttachedImages();
  }

  function removeAttachedImage(path) {
    attachedImages = attachedImages.filter(i => i.path !== path);
    renderAttachedImages();
  }

  function renderAttachedImages() {
    const container = document.getElementById('attachedImagesContainer');
    if (attachedImages.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = attachedImages.map((image, index) => `
      <div class="attached-image" data-path="${escapeHtml(image.path)}" data-index="${index}">
        ${image.dataUri ? `<img src="${sanitizeDataUri(image.dataUri)}" alt="${escapeHtml(image.name)}" class="image-thumbnail" />` : ''}
        <span class="codicon codicon-file-media"></span>
        <span class="image-name">${escapeHtml(image.name)}</span>
        <button class="remove-image" data-index="${index}">
          <span class="codicon codicon-close"></span>
        </button>
      </div>
    `).join('');

    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-image').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index, 10);
        if (!isNaN(index) && attachedImages[index]) {
          removeAttachedImage(attachedImages[index].path);
        }
      });
    });
  }

  function executeSlashCommand(command) {
    switch (command) {
      case '/clear':
        handleClear();
        break;
      case '/model':
        vscode.postMessage({ type: 'selectModel' });
        break;
      case '/help':
        showHelp();
        break;
      case '/compact':
        vscode.postMessage({ type: 'compactHistory' });
        break;
      case '/thinking':
        toggleThinking();
        break;
      case '/files':
        triggerFilePicker();
        break;
      case '/diff':
        vscode.postMessage({ type: 'addGitDiff' });
        break;
      case '/image':
        triggerImagePicker();
        break;
      case '/rewind':
        vscode.postMessage({ type: 'rewind' });
        break;
      case '/session':
        vscode.postMessage({ type: 'manageSessions' });
        break;
      case '/errors':
        vscode.postMessage({ type: 'autoFixErrors' });
        break;
      case '/hooks':
        vscode.postMessage({ type: 'manageHooks' });
        break;
    }
  }

  function showHelp() {
    const helpContent = `**AX CLI Chat Help**

**Keyboard Shortcuts:**
- \`Ctrl+Enter\` - Send message
- \`@\` - Mention files to include as context
- \`/\` - Show slash commands
- \`Esc\` - Close autocomplete

**Slash Commands:**
${SLASH_COMMANDS.map(c => `- \`${c.command}\` - ${c.description}`).join('\n')}

**Features:**
- Extended thinking mode shows AI reasoning
- Mentioned files are included as context
- Code blocks have copy/apply buttons`;

    addMessage({
      id: generateId(),
      role: 'system',
      content: helpContent,
      timestamp: new Date().toISOString(),
    });
  }

  function toggleThinking() {
    extendedThinking = !extendedThinking;
    updateThinkingButton();
    saveState();

    vscode.postMessage({
      type: 'setExtendedThinking',
      value: extendedThinking
    });

    // Show feedback
    addMessage({
      id: generateId(),
      role: 'system',
      content: `Extended thinking ${extendedThinking ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString(),
    });
  }

  function updateThinkingButton() {
    const btn = document.getElementById('thinkingButton');
    if (btn) {
      btn.classList.toggle('active', extendedThinking);
      btn.title = extendedThinking ? 'Extended Thinking: ON' : 'Extended Thinking: OFF';
    }
  }

  function handleSend() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message || isLoading) {
      return;
    }

    // Check for slash command at start
    if (message.startsWith('/')) {
      const cmd = SLASH_COMMANDS.find(c => message.startsWith(c.command));
      if (cmd) {
        executeSlashCommand(cmd.command);
        input.value = '';
        return;
      }
    }

    // Add user message immediately
    addMessage({
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      files: [...mentionedFiles],
      images: [...attachedImages]
    });

    // Send to extension with context
    vscode.postMessage({
      type: 'sendMessage',
      message: message,
      context: {
        files: mentionedFiles.map(f => f.path),
        images: attachedImages.map(i => ({ path: i.path, dataUri: i.dataUri })),
        extendedThinking: extendedThinking
      }
    });

    // Clear input, mentioned files, and attached images
    input.value = '';
    input.style.height = 'auto';
    mentionedFiles = [];
    attachedImages = [];
    renderMentionedFiles();
    renderAttachedImages();
  }

  function handleClear() {
    if (confirm('Clear chat history?')) {
      messages = [];
      renderMessages();
      saveState();
      vscode.postMessage({ type: 'clearHistory' });
    }
  }

  function addMessage(message) {
    messages.push(message);
    renderMessages();
    saveState();
  }

  function saveState() {
    vscode.setState({
      messages: messages,
      extendedThinking: extendedThinking
    });
  }

  function renderMessages() {
    const container = document.getElementById('messages');
    container.innerHTML = '';

    messages.forEach(msg => {
      const messageEl = createMessageElement(msg);
      container.appendChild(messageEl);
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message message-${message.role}`;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = message.role === 'user' ?
      '<span class="codicon codicon-account"></span>' :
      message.role === 'assistant' ?
      '<span class="codicon codicon-hubot"></span>' :
      '<span class="codicon codicon-info"></span>';

    // Content
    const content = document.createElement('div');
    content.className = 'message-content';

    // Header
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
      <span class="message-role">${message.role === 'assistant' ? 'AX' : message.role}</span>
      <span class="message-time">${formatTime(message.timestamp)}</span>
    `;

    // Files indicator for user messages
    if (message.role === 'user' && message.files && message.files.length > 0) {
      const filesIndicator = document.createElement('div');
      filesIndicator.className = 'message-files';
      filesIndicator.innerHTML = message.files.map(f =>
        `<span class="file-badge"><span class="codicon codicon-file"></span>${escapeHtml(f.name)}</span>`
      ).join('');
      content.appendChild(filesIndicator);
    }

    // Images indicator for user messages
    if (message.role === 'user' && message.images && message.images.length > 0) {
      const imagesIndicator = document.createElement('div');
      imagesIndicator.className = 'message-images';
      imagesIndicator.innerHTML = message.images.map(img =>
        `<div class="image-preview">
          ${img.dataUri ? `<img src="${sanitizeDataUri(img.dataUri)}" alt="${escapeHtml(img.name)}" class="message-image-thumbnail" />` : ''}
          <span class="image-badge"><span class="codicon codicon-file-media"></span>${escapeHtml(img.name)}</span>
        </div>`
      ).join('');
      content.appendChild(imagesIndicator);
    }

    // Thinking section (for extended thinking)
    if (message.thinking) {
      const thinkingSection = document.createElement('details');
      thinkingSection.className = 'thinking-section';
      thinkingSection.innerHTML = `
        <summary><span class="codicon codicon-lightbulb"></span> Thinking...</summary>
        <div class="thinking-content">${escapeHtml(message.thinking)}</div>
      `;
      content.appendChild(thinkingSection);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'message-body';

    if (message.role === 'system') {
      body.classList.add('message-system');
    }

    // Render markdown-like content
    body.innerHTML = renderContent(message.content);

    content.appendChild(header);
    content.appendChild(body);

    div.appendChild(avatar);
    div.appendChild(content);

    // Add code action buttons
    if (message.role === 'assistant') {
      const codeBlocks = body.querySelectorAll('pre code');
      codeBlocks.forEach((code, index) => {
        const actions = document.createElement('div');
        actions.className = 'code-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-action-button';
        copyBtn.innerHTML = '<span class="codicon codicon-copy"></span> Copy';
        copyBtn.onclick = () => handleCopyCode(code.textContent);

        const applyBtn = document.createElement('button');
        applyBtn.className = 'code-action-button';
        applyBtn.innerHTML = '<span class="codicon codicon-check"></span> Apply';
        applyBtn.onclick = () => handleApplyCode(code.textContent);

        actions.appendChild(copyBtn);
        actions.appendChild(applyBtn);

        code.parentElement.insertBefore(actions, code);
      });
    }

    return div;
  }

  function renderContent(content) {
    // Basic markdown-like rendering
    let html = escapeHtml(content);

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold - use non-greedy matching to handle nested cases better
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Lists - wrap consecutive list items in a single ul
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Paragraphs
    html = html.split('\n\n').map(p => {
      if (!p.startsWith('<') && p.trim()) {
        return `<p>${p}</p>`;
      }
      return p;
    }).join('\n');

    return html;
  }

  function handleCopyCode(code) {
    vscode.postMessage({
      type: 'copyCode',
      code: code,
    });
  }

  function handleApplyCode(code) {
    vscode.postMessage({
      type: 'applyCode',
      code: code,
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Validate and sanitize data URI for use in img src attribute
   * Only allows safe image data URIs (data:image/*)
   */
  function sanitizeDataUri(dataUri) {
    if (!dataUri || typeof dataUri !== 'string') {
      return '';
    }
    // Only allow data URIs that are images
    const dataUriPattern = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|bmp|ico);base64,[A-Za-z0-9+/=]+$/;
    if (dataUriPattern.test(dataUri)) {
      return dataUri;
    }
    // Return empty string for invalid/unsafe URIs
    return '';
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  function focusInput() {
    const input = document.getElementById('messageInput');
    if (input) {
      input.focus();
    }
  }

  function setLoading(loading) {
    isLoading = loading;
    const sendBtn = document.getElementById('sendButton');

    if (loading) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span class="codicon codicon-loading codicon-modifier-spin"></span> Thinking...';

      // Add loading message
      const loadingMsg = {
        id: 'loading',
        role: 'assistant',
        content: '...',
        timestamp: new Date().toISOString(),
      };
      messages.push(loadingMsg);
      renderMessages();
    } else {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="codicon codicon-send"></span> Send';

      // Remove loading message
      messages = messages.filter(m => m.id !== 'loading');
      renderMessages();
      focusInput();
    }
  }

  // Handle messages from extension
  window.addEventListener('message', event => {
    const message = event.data;

    switch (message.type) {
      case 'updateMessages':
        messages = message.messages;
        renderMessages();
        saveState();
        break;
      case 'loading':
        setLoading(message.value);
        break;
      case 'showDiff':
        // Show diff preview (Claude Code-like!)
        showDiffViewer(message.change);
        break;
      case 'filesResult':
        // Received file list from extension
        renderFilePicker(message.files);
        break;
      case 'restoreState':
        // Restore state from extension (e.g., after reload)
        if (message.messages) {
          messages = message.messages;
          renderMessages();
        }
        if (message.extendedThinking !== undefined) {
          extendedThinking = message.extendedThinking;
          updateThinkingButton();
        }
        saveState();
        break;
      case 'streamChunk':
        // Handle streaming response
        handleStreamChunk(message.chunk);
        break;
      case 'insertFiles':
        // Files inserted from native file picker (Cmd+Alt+K)
        if (message.files) {
          message.files.forEach(file => addMentionedFile(file.path, file.name));
        }
        break;
      case 'attachImages':
        // Images attached from native image picker (Cmd+Alt+I)
        if (message.images) {
          message.images.forEach(image => addAttachedImage(image));
        }
        break;
      case 'sessionChanged':
        // Session was changed
        currentSession = message.session;
        updateSessionIndicator();
        break;
      default:
        break;
    }
  });

  function updateSessionIndicator() {
    const header = document.querySelector('.chat-header h3');
    if (header && currentSession) {
      header.textContent = currentSession.name;
      header.title = `Session: ${currentSession.name}`;
    } else if (header) {
      header.textContent = 'AX CLI Assistant';
    }
  }

  function handleStreamChunk(chunk) {
    // Find or create streaming message
    let streamingMsg = messages.find(m => m.id === 'streaming');

    if (!streamingMsg) {
      streamingMsg = {
        id: 'streaming',
        role: 'assistant',
        content: '',
        thinking: '',
        timestamp: new Date().toISOString(),
      };
      messages.push(streamingMsg);
    }

    if (chunk.type === 'thinking') {
      streamingMsg.thinking += chunk.content;
    } else if (chunk.type === 'content') {
      streamingMsg.content += chunk.content;
    } else if (chunk.type === 'done') {
      // Finalize streaming message
      streamingMsg.id = generateId();
      saveState();
    }

    renderMessages();
  }

  // Diff viewer integration
  function showDiffViewer(change) {
    console.log('[Main.js] Showing diff for:', change.file);

    const diffContainer = document.getElementById('diff-container');
    if (!diffContainer) {
      console.error('[Main.js] diff-container not found!');
      return;
    }

    // Use DiffViewer class (from diff-viewer.js)
    if (typeof DiffViewer === 'undefined') {
      console.error('[Main.js] DiffViewer class not loaded!');
      return;
    }

    const viewer = new DiffViewer(diffContainer);
    viewer.render(change.oldContent, change.newContent, change.file, 'side-by-side');

    // Override global functions for Accept/Reject buttons
    window.acceptDiff = function() {
      console.log('[Main.js] User accepted diff:', change.id);
      vscode.postMessage({ type: 'approveDiff', changeId: change.id });
      diffContainer.innerHTML = ''; // Clear diff viewer
    };

    window.rejectDiff = function() {
      console.log('[Main.js] User rejected diff:', change.id);
      vscode.postMessage({ type: 'rejectDiff', changeId: change.id });
      diffContainer.innerHTML = ''; // Clear diff viewer
    };

    window.showInEditor = function() {
      console.log('[Main.js] User wants to see diff in editor:', change.id);
      vscode.postMessage({ type: 'showDiffInEditor', changeId: change.id });
    };

    // Scroll diff viewer into view
    diffContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
