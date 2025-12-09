/**
 * MCP Resource Subscriptions
 *
 * Enables clients to subscribe to resource changes and receive notifications
 * when resources are updated.
 *
 * MCP Specification:
 * - resources/subscribe - Subscribe to a resource
 * - resources/unsubscribe - Unsubscribe from a resource
 * - notifications/resources/updated - Resource update notification
 * - notifications/resources/list_changed - Resource list change notification
 *
 * @module mcp/subscriptions
 */

import { EventEmitter } from 'events';
import type { ServerName } from './type-safety.js';
import { Result, Ok, Err } from './type-safety.js';

/**
 * Resource subscription information
 */
export interface ResourceSubscription {
  /** Resource URI */
  uri: string;
  /** Server providing the resource */
  serverName: ServerName;
  /** When the subscription was created */
  subscribedAt: Date;
}

/**
 * Callback for sending subscription requests to server
 */
export type SendSubscriptionRequest = (
  serverName: ServerName,
  method: 'resources/subscribe' | 'resources/unsubscribe',
  uri: string
) => Promise<Result<void, Error>>;

/**
 * Callback for checking server capabilities
 */
export type CheckServerCapabilities = (
  serverName: ServerName
) => Promise<{ supportsSubscriptions: boolean }>;

/**
 * Subscription Manager
 *
 * Manages resource subscriptions across MCP servers.
 *
 * @example
 * ```typescript
 * const manager = new SubscriptionManager();
 *
 * // Subscribe to a resource
 * await manager.subscribe('filesystem', 'file:///config.json');
 *
 * // Listen for updates
 * manager.on('resource-updated', (uri, serverName) => {
 *   console.log(`Resource updated: ${uri} from ${serverName}`);
 * });
 *
 * // Unsubscribe
 * await manager.unsubscribe('filesystem', 'file:///config.json');
 * ```
 */
export class SubscriptionManager extends EventEmitter {
  private subscriptions = new Map<string, ResourceSubscription>();
  private sendRequest: SendSubscriptionRequest | null = null;
  private checkCapabilities: CheckServerCapabilities | null = null;

  /**
   * Set the request sender function
   * Called by MCPManagerV2 to wire up the request mechanism
   */
  setSendRequest(fn: SendSubscriptionRequest): void {
    this.sendRequest = fn;
  }

  /**
   * Set the capabilities checker function
   * Called by MCPManagerV2 to wire up capability checking
   */
  setCheckCapabilities(fn: CheckServerCapabilities): void {
    this.checkCapabilities = fn;
  }

  /**
   * Get subscription key for internal storage
   */
  private getKey(serverName: ServerName, uri: string): string {
    return `${serverName}:${uri}`;
  }

  /**
   * Subscribe to a resource
   *
   * @param serverName - Server providing the resource
   * @param uri - Resource URI to subscribe to
   * @returns Result indicating success or error
   */
  async subscribe(
    serverName: ServerName,
    uri: string
  ): Promise<Result<void, Error>> {
    // Check if already subscribed
    const key = this.getKey(serverName, uri);
    if (this.subscriptions.has(key)) {
      return Ok(undefined); // Already subscribed
    }

    // Check server capabilities
    if (this.checkCapabilities) {
      const caps = await this.checkCapabilities(serverName);
      if (!caps.supportsSubscriptions) {
        return Err(new Error(`Server ${serverName} does not support resource subscriptions`));
      }
    }

    // Send subscription request
    if (!this.sendRequest) {
      return Err(new Error('Subscription manager not initialized'));
    }

    const result = await this.sendRequest(serverName, 'resources/subscribe', uri);
    if (!result.success) {
      return result;
    }

    // Track the subscription
    this.subscriptions.set(key, {
      uri,
      serverName,
      subscribedAt: new Date(),
    });

    this.emit('subscribed', uri, serverName);
    return Ok(undefined);
  }

  /**
   * Unsubscribe from a resource
   *
   * @param serverName - Server providing the resource
   * @param uri - Resource URI to unsubscribe from
   * @returns Result indicating success or error
   */
  async unsubscribe(
    serverName: ServerName,
    uri: string
  ): Promise<Result<void, Error>> {
    const key = this.getKey(serverName, uri);

    if (!this.subscriptions.has(key)) {
      return Ok(undefined); // Not subscribed
    }

    // Send unsubscription request
    if (this.sendRequest) {
      const result = await this.sendRequest(serverName, 'resources/unsubscribe', uri);
      if (!result.success) {
        // Log but don't fail - we'll still clean up locally
        console.warn(`Failed to unsubscribe from ${uri}: ${result.error.message}`);
      }
    }

    // Remove from tracking
    this.subscriptions.delete(key);
    this.emit('unsubscribed', uri, serverName);
    return Ok(undefined);
  }

  /**
   * Handle resource update notification from server
   *
   * @param serverName - Server that sent the notification
   * @param uri - Updated resource URI
   */
  handleResourceUpdated(serverName: ServerName, uri: string): void {
    const key = this.getKey(serverName, uri);
    if (this.subscriptions.has(key)) {
      this.emit('resource-updated', uri, serverName);
    }
  }

  /**
   * Handle resource list change notification from server
   *
   * @param serverName - Server that sent the notification
   */
  handleResourceListChanged(serverName: ServerName): void {
    this.emit('resource-list-changed', serverName);
  }

  /**
   * Get all active subscriptions
   *
   * @returns Array of active subscriptions
   */
  getActiveSubscriptions(): ResourceSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscriptions for a specific server
   *
   * @param serverName - Server to get subscriptions for
   * @returns Array of subscriptions for the server
   */
  getSubscriptionsForServer(serverName: ServerName): ResourceSubscription[] {
    return this.getActiveSubscriptions().filter(
      sub => sub.serverName === serverName
    );
  }

  /**
   * Check if subscribed to a resource
   *
   * @param serverName - Server providing the resource
   * @param uri - Resource URI
   * @returns true if subscribed
   */
  isSubscribed(serverName: ServerName, uri: string): boolean {
    return this.subscriptions.has(this.getKey(serverName, uri));
  }

  /**
   * Get the number of active subscriptions
   *
   * @returns Number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Resubscribe all subscriptions for a server
   * Called after server reconnection
   *
   * @param serverName - Server to resubscribe for
   * @returns Results of resubscription attempts
   */
  async resubscribeForServer(
    serverName: ServerName
  ): Promise<Array<{ uri: string; result: Result<void, Error> }>> {
    const subs = this.getSubscriptionsForServer(serverName);
    const results: Array<{ uri: string; result: Result<void, Error> }> = [];

    for (const sub of subs) {
      // Remove existing subscription first
      this.subscriptions.delete(this.getKey(serverName, sub.uri));

      // Resubscribe
      const result = await this.subscribe(serverName, sub.uri);
      results.push({ uri: sub.uri, result });
    }

    return results;
  }

  /**
   * Unsubscribe from all resources on a server
   * Called during server disconnection
   *
   * @param serverName - Server to unsubscribe from
   */
  unsubscribeAllForServer(serverName: ServerName): void {
    const subs = this.getSubscriptionsForServer(serverName);
    for (const sub of subs) {
      this.subscriptions.delete(this.getKey(serverName, sub.uri));
      this.emit('unsubscribed', sub.uri, serverName);
    }
  }

  /**
   * Cleanup all subscriptions
   */
  cleanupAll(): void {
    for (const [key, sub] of this.subscriptions.entries()) {
      this.subscriptions.delete(key);
      this.emit('unsubscribed', sub.uri, sub.serverName);
    }
  }

  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Singleton instance
let subscriptionManager: SubscriptionManager | null = null;

/**
 * Get the singleton subscription manager instance
 */
export function getSubscriptionManager(): SubscriptionManager {
  if (!subscriptionManager) {
    subscriptionManager = new SubscriptionManager();
  }
  return subscriptionManager;
}

/**
 * Reset the subscription manager (for testing)
 */
export function resetSubscriptionManager(): void {
  if (subscriptionManager) {
    subscriptionManager.cleanupAll();
    subscriptionManager.removeAllListeners();
  }
  subscriptionManager = null;
}
