/**
 * Permission System Exports
 *
 * Phase 3: Permission-First Architecture
 *
 * Architecture:
 * - PermissionManager: Main permission checking logic
 * - SessionStateManager: Centralized session approval state
 * - safety-rules.ts (in utils/): Single source of truth for patterns
 */

export {
  PermissionManager,
  PermissionTier,
  type PermissionRequest,
  type PermissionResult,
  type RiskLevel,
  getPermissionManager,
  initializePermissionManager,
  resetPermissionManager,
} from './permission-manager.js';

export {
  SessionStateManager,
  getSessionState,
  resetSessionState,
  type SessionFlags,
} from './session-state.js';
