/**
 * IPC Module - Communication between CLI and VS Code Extension
 *
 * Provides bidirectional communication for:
 * - Diff preview and approval before file modifications
 * - Task completion summaries
 * - Status updates
 */

export {
  VSCodeIPCClient,
  getVSCodeIPCClient,
  disposeVSCodeIPCClient,
  StreamSession,
  type DiffPayload,
  type TaskSummaryPayload,
  type StreamChunkPayload,
  type FileRevealPayload
} from './vscode-client.js';
