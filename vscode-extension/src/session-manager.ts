/**
 * Session Manager - Manages multiple chat sessions
 *
 * Similar to Claude Code's ability to run parallel sessions
 * in different workspace folders.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  files?: Array<{ path: string; name: string }>;
  images?: Array<{ path: string; name: string; dataUri?: string }>;
}

export interface ChatSession {
  id: string;
  name: string;
  workspaceFolder?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  isActive: boolean;
}

const SESSIONS_DIR = path.join(os.homedir(), '.ax-cli', 'sessions');
const MAX_SESSIONS = 20;

export class SessionManager implements vscode.Disposable {
  private sessions: Map<string, ChatSession> = new Map();
  private activeSessionId: string | null = null;
  private onSessionChangedEmitter = new vscode.EventEmitter<ChatSession | null>();

  public readonly onSessionChanged = this.onSessionChangedEmitter.event;

  constructor() {
    this.ensureSessionsDir();
    this.loadSessions();
  }

  /**
   * Ensure sessions directory exists
   */
  private ensureSessionsDir(): void {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error('[AX Sessions] Failed to create sessions directory:', error);
    }
  }

  /**
   * Load existing sessions from disk
   */
  private loadSessions(): void {
    try {
      const files = fs.readdirSync(SESSIONS_DIR);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(SESSIONS_DIR, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const session: ChatSession = JSON.parse(data);

          // Validate required session fields
          if (!session.id || !session.name || !Array.isArray(session.messages)) {
            console.warn(`[AX Sessions] Skipping invalid session file ${file}: missing required fields`);
            continue;
          }

          this.sessions.set(session.id, session);
        } catch (error) {
          console.error(`[AX Sessions] Failed to load session ${file}:`, error);
        }
      }

      console.log(`[AX Sessions] Loaded ${this.sessions.size} sessions`);

      // Activate the most recent session
      const sessions = this.getAllSessions();
      if (sessions.length > 0) {
        this.activeSessionId = sessions[0].id;
      }
    } catch (error) {
      console.error('[AX Sessions] Failed to load sessions:', error);
    }
  }

  /**
   * Save a session to disk
   */
  private saveSession(session: ChatSession): void {
    try {
      const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`[AX Sessions] Failed to save session ${session.id}:`, error);
    }
  }

  /**
   * Create a new session
   */
  createSession(name?: string, workspaceFolder?: string): ChatSession {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Default name based on workspace or timestamp
    const sessionName = name || this.generateSessionName(workspaceFolder);

    const session: ChatSession = {
      id: sessionId,
      name: sessionName,
      workspaceFolder,
      createdAt: now,
      updatedAt: now,
      messages: [],
      isActive: true
    };

    this.sessions.set(sessionId, session);
    this.saveSession(session);
    this.setActiveSession(sessionId);

    // Enforce max sessions
    this.enforceMaxSessions();

    console.log(`[AX Sessions] Created session ${sessionId}: ${sessionName}`);

    return session;
  }

  /**
   * Generate a session name
   */
  private generateSessionName(workspaceFolder?: string): string {
    if (workspaceFolder) {
      return path.basename(workspaceFolder);
    }

    const now = new Date();
    return `Chat ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  /**
   * Get the active session
   */
  getActiveSession(): ChatSession | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Set the active session
   */
  setActiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Deactivate current session
    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const current = this.sessions.get(this.activeSessionId);
      if (current) {
        current.isActive = false;
        this.saveSession(current);
      }
    }

    // Activate new session
    session.isActive = true;
    this.activeSessionId = sessionId;
    this.saveSession(session);
    this.onSessionChangedEmitter.fire(session);

    console.log(`[AX Sessions] Activated session ${sessionId}`);

    return true;
  }

  /**
   * Get all sessions sorted by updatedAt
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Add a message to the active session
   */
  addMessage(message: ChatMessage): boolean {
    const session = this.getActiveSession();
    if (!session) {
      return false;
    }

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    this.saveSession(session);

    return true;
  }

  /**
   * Get messages from the active session
   */
  getMessages(): ChatMessage[] {
    const session = this.getActiveSession();
    return session?.messages || [];
  }

  /**
   * Clear messages from the active session
   */
  clearMessages(): boolean {
    const session = this.getActiveSession();
    if (!session) {
      return false;
    }

    session.messages = [];
    session.updatedAt = new Date().toISOString();
    this.saveSession(session);

    return true;
  }

  /**
   * Rename a session
   */
  renameSession(sessionId: string, newName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.name = newName;
    session.updatedAt = new Date().toISOString();
    this.saveSession(session);

    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from disk
    try {
      const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`[AX Sessions] Failed to delete session file ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);

    // If this was the active session, activate another
    if (this.activeSessionId === sessionId) {
      const remaining = this.getAllSessions();
      if (remaining.length > 0) {
        this.setActiveSession(remaining[0].id);
      } else {
        this.activeSessionId = null;
        this.onSessionChangedEmitter.fire(null);
      }
    }

    console.log(`[AX Sessions] Deleted session ${sessionId}`);

    return true;
  }

  /**
   * Enforce maximum number of sessions
   */
  private enforceMaxSessions(): void {
    const sessions = this.getAllSessions();

    if (sessions.length > MAX_SESSIONS) {
      const toDelete = sessions.slice(MAX_SESSIONS);

      for (const session of toDelete) {
        this.deleteSession(session.id);
      }

      console.log(`[AX Sessions] Deleted ${toDelete.length} old sessions`);
    }
  }

  /**
   * Show session picker
   */
  async showSessionPicker(): Promise<ChatSession | null> {
    const sessions = this.getAllSessions();

    if (sessions.length === 0) {
      const createNew = await vscode.window.showQuickPick(
        [{ label: '$(add) Create New Session', action: 'create' }],
        { placeHolder: 'No sessions found' }
      );

      if (createNew?.action === 'create') {
        return this.createSession();
      }
      return null;
    }

    const items = [
      { label: '$(add) New Session', description: 'Create a new chat session', action: 'create', session: null as ChatSession | null },
      { label: '', kind: vscode.QuickPickItemKind.Separator, action: '', session: null as ChatSession | null },
      ...sessions.map(s => ({
        label: `${s.isActive ? '$(check) ' : ''}${s.name}`,
        description: `${s.messages.length} messages`,
        detail: `Last updated: ${new Date(s.updatedAt).toLocaleString()}`,
        action: 'select',
        session: s
      }))
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select or create a session',
      title: 'Chat Sessions'
    });

    if (!selected) {
      return null;
    }

    if (selected.action === 'create') {
      return this.createSession();
    }

    if (selected.action === 'select' && selected.session) {
      this.setActiveSession(selected.session.id);
      return selected.session;
    }

    return null;
  }

  /**
   * Show session management menu
   */
  async showSessionMenu(): Promise<void> {
    const session = this.getActiveSession();

    const actions = [
      { label: '$(add) New Session', action: 'new' },
      { label: '$(list-selection) Switch Session', action: 'switch' },
    ];

    if (session) {
      actions.push(
        { label: '$(edit) Rename Session', action: 'rename' },
        { label: '$(trash) Delete Session', action: 'delete' }
      );
    }

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: session ? `Current: ${session.name}` : 'No active session',
      title: 'Session Management'
    });

    if (!selected) return;

    switch (selected.action) {
      case 'new':
        // createSession() already fires onSessionChangedEmitter via setActiveSession()
        this.createSession();
        break;

      case 'switch':
        await this.showSessionPicker();
        break;

      case 'rename':
        if (session) {
          const newName = await vscode.window.showInputBox({
            prompt: 'Enter new session name',
            value: session.name
          });
          if (newName) {
            this.renameSession(session.id, newName);
            // Fire event so UI updates with new name
            this.onSessionChangedEmitter.fire(session);
          }
        }
        break;

      case 'delete':
        if (session) {
          const confirmed = await vscode.window.showWarningMessage(
            `Delete session "${session.name}"?`,
            { modal: true },
            'Delete'
          );
          if (confirmed === 'Delete') {
            this.deleteSession(session.id);
          }
        }
        break;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.onSessionChangedEmitter.dispose();
  }
}
