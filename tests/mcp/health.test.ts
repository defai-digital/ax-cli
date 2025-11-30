/**
 * Tests for MCP Health Monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPHealthMonitor } from '../../src/mcp/health.js';
import type { MCPManager } from '../../src/llm/tools.js';

// Mock MCPManager
const createMockMCPManager = (): MCPManager => {
  const servers = new Set<string>();
  const tools = new Map<string, any[]>();

  return {
    getServers: () => Array.from(servers),
    getTools: () => {
      const allTools: any[] = [];
      for (const [serverName, serverTools] of tools.entries()) {
        allTools.push(...serverTools.map(t => ({ ...t, serverName })));
      }
      return allTools;
    },
    addServer: (name: string, serverTools: any[]) => {
      servers.add(name);
      tools.set(name, serverTools);
    },
    removeServer: (name: string) => {
      servers.delete(name);
      tools.delete(name);
    },
  } as any;
};

describe('MCPHealthMonitor', () => {
  let mcpManager: MCPManager;
  let healthMonitor: MCPHealthMonitor;

  beforeEach(() => {
    mcpManager = createMockMCPManager();
    healthMonitor = new MCPHealthMonitor(mcpManager);
  });

  afterEach(() => {
    healthMonitor.stop();
  });

  describe('Initialization', () => {
    it('should create health monitor with MCPManager', () => {
      expect(healthMonitor).toBeInstanceOf(MCPHealthMonitor);
    });

    it('should not have health check interval on creation', () => {
      expect((healthMonitor as any).healthCheckInterval).toBeNull();
    });
  });

  describe('Health Monitoring', () => {
    it('should start health monitoring', () => {
      healthMonitor.start(1000);
      expect((healthMonitor as any).healthCheckInterval).not.toBeNull();
    });

    it('should stop health monitoring', () => {
      healthMonitor.start(1000);
      healthMonitor.stop();
      expect((healthMonitor as any).healthCheckInterval).toBeNull();
    });

    it('should throw error if already started', () => {
      healthMonitor.start(1000);
      expect(() => healthMonitor.start(1000)).toThrow('Health monitoring already started');
    });
  });

  describe('Server Health Checking', () => {
    it('should check health of a connected server', async () => {
      (mcpManager as any).addServer('figma', [
        { name: 'tool1', description: 'Test tool 1' },
        { name: 'tool2', description: 'Test tool 2' },
      ]);

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.serverName).toBe('figma');
      expect(health.connected).toBe(true);
      expect(health.toolCount).toBe(2);
      expect(health.successRate).toBe(100); // No failures yet
    });

    it('should report disconnected server', async () => {
      const health = await healthMonitor.checkServerHealth('nonexistent');

      expect(health.serverName).toBe('nonexistent');
      expect(health.connected).toBe(false);
      expect(health.toolCount).toBe(0);
    });

    it('should calculate uptime', async () => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);

      // Initialize stats with a past timestamp
      const pastTime = Date.now() - 1000; // 1 second ago
      (healthMonitor as any).serverStats.set('figma', {
        connectedAt: pastTime,
        successCount: 0,
        failureCount: 0,
        latencies: [],
      });

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.uptime).toBeGreaterThanOrEqual(1000); // At least 1 second
      expect(health.connectedAt).toBe(pastTime);
    });
  });

  describe('Success/Failure Recording', () => {
    beforeEach(() => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);
    });

    it('should record successful tool calls', async () => {
      healthMonitor.recordSuccess('figma', 50);
      healthMonitor.recordSuccess('figma', 60);
      healthMonitor.recordSuccess('figma', 70);

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.successCount).toBe(3);
      expect(health.failureCount).toBe(0);
      expect(health.successRate).toBe(100);
      expect(health.lastSuccess).toBeDefined();
    });

    it('should record failed tool calls', async () => {
      healthMonitor.recordFailure('figma', 'Connection timeout');
      healthMonitor.recordFailure('figma', 'Authentication failed');

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.successCount).toBe(0);
      expect(health.failureCount).toBe(2);
      expect(health.successRate).toBe(0);
      expect(health.lastError).toBe('Authentication failed');
      expect(health.lastErrorAt).toBeDefined();
    });

    it('should calculate success rate correctly', async () => {
      healthMonitor.recordSuccess('figma', 50);
      healthMonitor.recordSuccess('figma', 60);
      healthMonitor.recordSuccess('figma', 70);
      healthMonitor.recordFailure('figma', 'Error');

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.successRate).toBe(75); // 3 successes out of 4 total
    });

    it('should track latency metrics', async () => {
      healthMonitor.recordSuccess('figma', 50);
      healthMonitor.recordSuccess('figma', 60);
      healthMonitor.recordSuccess('figma', 70);
      healthMonitor.recordSuccess('figma', 80);
      healthMonitor.recordSuccess('figma', 90);

      const health = await healthMonitor.checkServerHealth('figma');

      expect(health.avgLatency).toBe(70); // Average of 50, 60, 70, 80, 90
      expect(health.p95Latency).toBeDefined();
    });
  });

  describe('Health Report', () => {
    it('should generate health report for all servers', async () => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);
      (mcpManager as any).addServer('github', [{ name: 'tool2' }]);

      const report = await healthMonitor.getHealthReport();

      expect(report).toHaveLength(2);
      expect(report[0].serverName).toBe('figma');
      expect(report[1].serverName).toBe('github');
    });

    it('should return empty report when no servers connected', async () => {
      const report = await healthMonitor.getHealthReport();

      expect(report).toHaveLength(0);
    });
  });

  describe('Server Status', () => {
    it('should get status for specific server', async () => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);

      const status = await healthMonitor.getServerStatus('figma');

      expect(status).not.toBeNull();
      expect(status?.serverName).toBe('figma');
    });

    it('should return null for non-existent server', async () => {
      const status = await healthMonitor.getServerStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('Stats Reset', () => {
    it('should reset stats for a server', async () => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);

      healthMonitor.recordSuccess('figma', 50);
      healthMonitor.recordSuccess('figma', 60);

      let health = await healthMonitor.checkServerHealth('figma');
      expect(health.successCount).toBe(2);

      healthMonitor.resetStats('figma');

      health = await healthMonitor.checkServerHealth('figma');
      expect(health.successCount).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit health-check event', (done) => {
      (mcpManager as any).addServer('figma', [{ name: 'tool1' }]);

      healthMonitor.on('health-check', (health) => {
        expect(health.serverName).toBe('figma');
        done();
      });

      healthMonitor.start(100);
    });
  });
});

describe('MCPHealthMonitor - Static Helpers', () => {
  describe('formatUptime', () => {
    it('should format uptime in seconds', () => {
      const uptime = MCPHealthMonitor.formatUptime(5000); // 5 seconds
      expect(uptime).toBe('5s');
    });

    it('should format uptime in minutes', () => {
      const uptime = MCPHealthMonitor.formatUptime(125000); // 2 minutes 5 seconds
      expect(uptime).toBe('2m 5s');
    });

    it('should format uptime in hours', () => {
      const uptime = MCPHealthMonitor.formatUptime(7325000); // 2 hours 2 minutes
      expect(uptime).toBe('2h 2m');
    });

    it('should format uptime in days', () => {
      const uptime = MCPHealthMonitor.formatUptime(93600000); // 1 day 2 hours
      expect(uptime).toBe('1d 2h');
    });
  });

  describe('formatLatency', () => {
    it('should format latency in milliseconds', () => {
      const latency = MCPHealthMonitor.formatLatency(45);
      expect(latency).toBe('45ms');
    });

    it('should format latency in milliseconds (rounded)', () => {
      const latency = MCPHealthMonitor.formatLatency(45.7);
      expect(latency).toBe('46ms');
    });

    it('should format latency in seconds', () => {
      const latency = MCPHealthMonitor.formatLatency(1500);
      expect(latency).toBe('1.50s');
    });

    it('should format latency in seconds (high precision)', () => {
      const latency = MCPHealthMonitor.formatLatency(2345);
      expect(latency).toBe('2.35s');
    });
  });
});

describe('MCPHealthMonitor - Latency Calculations', () => {
  let mcpManager: MCPManager;
  let healthMonitor: MCPHealthMonitor;

  beforeEach(() => {
    mcpManager = createMockMCPManager();
    healthMonitor = new MCPHealthMonitor(mcpManager);
    (mcpManager as any).addServer('test', [{ name: 'tool1' }]);
  });

  afterEach(() => {
    healthMonitor.stop();
  });

  it('should calculate average latency correctly', async () => {
    const latencies = [10, 20, 30, 40, 50];
    latencies.forEach(lat => healthMonitor.recordSuccess('test', lat));

    const health = await healthMonitor.checkServerHealth('test');

    expect(health.avgLatency).toBe(30);
  });

  it('should calculate p95 latency correctly', async () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    latencies.forEach(lat => healthMonitor.recordSuccess('test', lat));

    const health = await healthMonitor.checkServerHealth('test');

    // P95 of [10,20,30,40,50,60,70,80,90,100] is the 95th percentile = 100
    expect(health.p95Latency).toBe(100);
  });

  it('should limit latency history to 100 entries', async () => {
    // Record 150 latencies
    for (let i = 0; i < 150; i++) {
      healthMonitor.recordSuccess('test', i);
    }

    const stats = (healthMonitor as any).serverStats.get('test');
    expect(stats.latencies.length).toBe(100);
  });
});
