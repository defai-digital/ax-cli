/**
 * Settings Panel Component
 * Allows users to configure AX CLI settings from within the WebView
 */

class SettingsPanel {
  constructor(container) {
    this.container = container;
    this.settings = {};
  }

  /**
   * Load and display settings
   * @param {Object} currentSettings - Current configuration
   */
  render(currentSettings = {}) {
    this.settings = currentSettings;

    this.container.innerHTML = `
      <div class="settings-panel">
        <div class="settings-header">
          <h3>AX CLI Settings</h3>
          <button class="icon-button" onclick="closeSettings()">
            <span class="codicon codicon-close"></span>
          </button>
        </div>

        <div class="settings-content">
          <!-- API Configuration -->
          <div class="settings-section">
            <h4 class="settings-section-title">
              <span class="codicon codicon-key"></span>
              API Configuration
            </h4>

            <div class="settings-field">
              <label>API Key</label>
              <div class="api-key-status">
                <span id="apiKeyStatus" class="status-badge ${this.settings.hasApiKey ? 'configured' : 'not-configured'}">
                  ${this.settings.hasApiKey ? '✓ Configured' : '✗ Not Set'}
                </span>
                <button class="settings-btn-inline" onclick="manageApiKey()">
                  ${this.settings.hasApiKey ? 'Change' : 'Set API Key'}
                </button>
              </div>
              <small class="settings-help">API key is stored securely using your system's credential manager</small>
            </div>

            <div class="settings-field">
              <label for="baseURL">Base URL</label>
              <input
                type="text"
                id="baseURL"
                class="settings-input"
                placeholder="https://api.x.ai/v1"
                value="${this.escapeHtml(this.settings.baseURL || 'https://api.x.ai/v1')}"
              />
              <small class="settings-help">API endpoint URL</small>
            </div>
          </div>

          <!-- Model Configuration -->
          <div class="settings-section">
            <h4 class="settings-section-title">
              <span class="codicon codicon-robot"></span>
              Model Configuration
            </h4>

            <div class="settings-field">
              <label for="model">Default Model</label>
              <select id="model" class="settings-select">
                ${this.renderModelOptions()}
              </select>
              <small class="settings-help">AI model to use for responses</small>
            </div>

            <div class="settings-field">
              <label for="maxToolRounds">Max Tool Rounds</label>
              <input
                type="number"
                id="maxToolRounds"
                class="settings-input"
                min="1"
                max="1000"
                value="${this.settings.maxToolRounds || 400}"
              />
              <small class="settings-help">Maximum tool execution rounds (1-1000)</small>
            </div>
          </div>

          <!-- Context Settings -->
          <div class="settings-section">
            <h4 class="settings-section-title">
              <span class="codicon codicon-file-code"></span>
              Context Settings
            </h4>

            <div class="settings-field checkbox-field">
              <input
                type="checkbox"
                id="autoIncludeFile"
                ${this.settings.autoIncludeFile !== false ? 'checked' : ''}
              />
              <label for="autoIncludeFile">Auto-include current file</label>
              <small class="settings-help">Automatically include active file in context</small>
            </div>

            <div class="settings-field checkbox-field">
              <input
                type="checkbox"
                id="autoIncludeDiagnostics"
                ${this.settings.autoIncludeDiagnostics !== false ? 'checked' : ''}
              />
              <label for="autoIncludeDiagnostics">Auto-include diagnostics</label>
              <small class="settings-help">Include errors and warnings automatically</small>
            </div>
          </div>

          <!-- Advanced Settings -->
          <div class="settings-section">
            <h4 class="settings-section-title">
              <span class="codicon codicon-settings-gear"></span>
              Advanced
            </h4>

            <div class="settings-field">
              <label for="temperature">Temperature</label>
              <input
                type="range"
                id="temperature"
                class="settings-range"
                min="0"
                max="2"
                step="0.1"
                value="${this.settings.temperature || 0.7}"
              />
              <span class="range-value">${this.settings.temperature || 0.7}</span>
              <small class="settings-help">Controls response randomness (0-2)</small>
            </div>

            <div class="settings-field">
              <label for="maxTokens">Max Tokens</label>
              <input
                type="number"
                id="maxTokens"
                class="settings-input"
                min="100"
                max="128000"
                value="${this.settings.maxTokens || 4096}"
              />
              <small class="settings-help">Maximum tokens in response</small>
            </div>
          </div>
        </div>

        <div class="settings-footer">
          <button class="settings-btn primary" onclick="saveSettings()">
            <span class="codicon codicon-save"></span>
            Save Settings
          </button>
          <button class="settings-btn secondary" onclick="resetSettings()">
            <span class="codicon codicon-discard"></span>
            Reset to Defaults
          </button>
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  renderModelOptions() {
    const models = [
      { value: 'grok-code-fast-1', label: 'Grok Code Fast' },
      { value: 'grok-4-latest', label: 'Grok 4 Latest' },
      { value: 'glm-4.6', label: 'GLM 4.6' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    ];

    return models.map(model => `
      <option value="${model.value}" ${this.settings.model === model.value ? 'selected' : ''}>
        ${model.label}
      </option>
    `).join('');
  }

  attachEventListeners() {
    // Update range value display
    const temperatureRange = this.container.querySelector('#temperature');
    if (temperatureRange) {
      temperatureRange.addEventListener('input', (e) => {
        const valueDisplay = this.container.querySelector('.range-value');
        if (valueDisplay) {
          valueDisplay.textContent = e.target.value;
        }
      });
    }
  }

  /**
   * Collect current settings from form
   * Note: API key is managed separately via SecretStorage
   */
  collectSettings() {
    const maxToolRoundsValue = parseInt(this.container.querySelector('#maxToolRounds')?.value || '400', 10);
    const maxTokensValue = parseInt(this.container.querySelector('#maxTokens')?.value || '4096', 10);
    const temperatureValue = parseFloat(this.container.querySelector('#temperature')?.value || '0.7');

    return {
      // API key is NOT collected here - it's managed via SecretStorage commands
      baseURL: this.container.querySelector('#baseURL')?.value || '',
      model: this.container.querySelector('#model')?.value || '',
      maxToolRounds: Number.isFinite(maxToolRoundsValue) && maxToolRoundsValue > 0 ? maxToolRoundsValue : 400,
      autoIncludeFile: this.container.querySelector('#autoIncludeFile')?.checked || false,
      autoIncludeDiagnostics: this.container.querySelector('#autoIncludeDiagnostics')?.checked || false,
      temperature: Number.isFinite(temperatureValue) && temperatureValue >= 0 && temperatureValue <= 2 ? temperatureValue : 0.7,
      maxTokens: Number.isFinite(maxTokensValue) && maxTokensValue > 0 ? maxTokensValue : 4096,
    };
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsPanel;
}
