(function() {
  const vscode = acquireVsCodeApi();

  // State
  let messages = [];
  let isLoading = false;

  // DOM elements
  const messagesContainer = document.getElementById('messages');
  const inputTextarea = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const clearButton = document.getElementById('clearButton');

  // Initialize
  function init() {
    createUI();
    attachEventListeners();
    focusInput();
  }

  function createUI() {
    document.body.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <h3>AX CLI Assistant</h3>
          <button id="clearButton" class="icon-button" title="Clear history">
            <span class="codicon codicon-clear-all"></span>
          </button>
        </div>
        <div id="messages" class="messages-container"></div>
        <div class="input-container">
          <textarea
            id="messageInput"
            class="message-input"
            placeholder="Ask me anything about your code..."
            rows="3"
          ></textarea>
          <button id="sendButton" class="send-button">
            <span class="codicon codicon-send"></span>
            Send
          </button>
        </div>
      </div>
    `;
  }

  function attachEventListeners() {
    const input = document.getElementById('messageInput');
    const send = document.getElementById('sendButton');
    const clear = document.getElementById('clearButton');

    send.addEventListener('click', handleSend);
    clear.addEventListener('click', handleClear);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    });
  }

  function handleSend() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message || isLoading) {
      return;
    }

    // Add user message immediately
    addMessage({
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Send to extension
    vscode.postMessage({
      type: 'sendMessage',
      message: message,
    });

    // Clear input
    input.value = '';
    input.style.height = 'auto';
  }

  function handleClear() {
    if (confirm('Clear chat history?')) {
      messages = [];
      renderMessages();
      vscode.postMessage({ type: 'clearHistory' });
    }
  }

  function addMessage(message) {
    messages.push(message);
    renderMessages();
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
      '<span class="codicon codicon-warning"></span>';

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

    // Body
    const body = document.createElement('div');
    body.className = 'message-body';

    if (message.role === 'system') {
      body.classList.add('message-error');
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

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

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
    const input = document.getElementById('messageInput');

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
        break;
      case 'loading':
        setLoading(message.value);
        break;
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
