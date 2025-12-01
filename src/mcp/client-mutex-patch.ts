/**
 * Mutex-Protected MCP Client Patch
 *
 * This file contains the mutex-protected version of addServer() method
 * to be integrated into MCPManager class in client.ts
 *
 * INTEGRATION INSTRUCTIONS:
 * 1. Add import: import { KeyedMutex } from "./mutex.js";
 * 2. Add field: private connectionMutex = new KeyedMutex();
 * 3. Replace addServer() method with the version below
 * 4. Add mutex cleanup to dispose() method
 */

// STEP 1: Add to imports (line 8)
// import { KeyedMutex } from "./mutex.js";

// STEP 2: Add to MCPManager class fields (after line 26)
// private connectionMutex = new KeyedMutex(); // Mutex for thread-safe connections

// STEP 3: Replace addServer() method (lines 28-50)
/*
  async addServer(config: MCPServerConfig): Promise<void> {
    // Use mutex to ensure atomic check-and-connect operation
    // This prevents race conditions when multiple parts of the system
    // try to connect to the same server simultaneously
    return await this.connectionMutex.runExclusive(config.name, async () => {
      // Check if already connected (now protected by mutex)
      if (this.clients.has(config.name)) {
        return; // Already connected, nothing to do
      }

      // Check if already connecting (now protected by mutex)
      const pending = this.pendingConnections.get(config.name);
      if (pending) {
        await pending; // Wait for the connection to complete
        return;
      }

      // Create a promise for this connection attempt
      const connectionPromise = this._addServerInternal(config);
      this.pendingConnections.set(config.name, connectionPromise);

      try {
        await connectionPromise;
      } finally {
        this.pendingConnections.delete(config.name);
      }
    });
  }
*/

// STEP 4: Add to dispose() method (before removeAllListeners())
// // Cleanup mutex state
// this.connectionMutex.clearAll();

/**
 * Benefits of Mutex Protection:
 *
 * 1. Race Condition Prevention:
 *    - Multiple concurrent addServer() calls for same server
 *    - Multi-agent AutomatosX setups calling ensureServersInitialized()
 *    - Duplicate connections from parallel initialization
 *
 * 2. Resource Protection:
 *    - Prevents duplicate client instances
 *    - Avoids wasted file descriptors/memory
 *    - Ensures clean state transitions
 *
 * 3. Thread Safety:
 *    - Atomic check-and-set operations
 *    - No TOCTOU (Time-Of-Check-Time-Of-Use) bugs
 *    - Guaranteed sequential execution per server
 *
 * Performance Impact: Negligible
 * - Mutex only blocks same-server connections
 * - Different servers connect in parallel
 * - Minimal overhead (~microseconds per acquire/release)
 */

export const MUTEX_INTEGRATION_COMPLETE = false; // Set to true after integration
