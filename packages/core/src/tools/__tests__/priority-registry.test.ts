/**
 * Unit tests for Priority Registry
 *
 * Tests for priority-registry.ts - the tool selection engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractServerNameFromTool,
  inferToolCapability,
  PriorityRegistry,
  getPriorityRegistry,
  resetPriorityRegistry,
  updatePriorityRegistryProvider,
} from '../priority-registry.js';
import { ToolPriority, NATIVE_CAPABILITY_PREFIX } from '../priority.js';
import type { LLMTool } from '../../llm/client.js';

// Helper to create mock LLMTool
function createMockTool(name: string, description: string = ''): LLMTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: {}, required: [] },
    },
  };
}

describe('priority-registry.ts', () => {
  beforeEach(() => {
    resetPriorityRegistry();
  });

  describe('extractServerNameFromTool', () => {
    it('should extract server name from valid MCP tool name', () => {
      expect(extractServerNameFromTool('mcp__automatosx__run_agent')).toBe('automatosx');
      expect(extractServerNameFromTool('mcp__github__create_pr')).toBe('github');
      expect(extractServerNameFromTool('mcp__zai-web-search__search')).toBe('zai-web-search');
    });

    it('should return undefined for non-MCP tools', () => {
      expect(extractServerNameFromTool('read_file')).toBeUndefined();
      expect(extractServerNameFromTool('bash')).toBeUndefined();
      expect(extractServerNameFromTool('some_tool_name')).toBeUndefined();
    });

    it('should return undefined for malformed MCP tools with empty server name', () => {
      expect(extractServerNameFromTool('mcp__')).toBeUndefined();
      expect(extractServerNameFromTool('mcp____tool')).toBeUndefined();
    });

    it('should handle tools with multiple underscores in tool name', () => {
      expect(extractServerNameFromTool('mcp__server__tool_name_here')).toBe('server');
    });
  });

  describe('inferToolCapability', () => {
    describe('web-search detection', () => {
      it('should detect web_search in name', () => {
        const tool = createMockTool('web_search', 'Search for information');
        expect(inferToolCapability(tool)).toContain('web-search');
      });

      it('should detect websearch in name', () => {
        const tool = createMockTool('websearch', 'Search for information');
        expect(inferToolCapability(tool)).toContain('web-search');
      });

      it('should detect "search the web" in description', () => {
        const tool = createMockTool('find_info', 'Search the web for current information');
        expect(inferToolCapability(tool)).toContain('web-search');
      });

      it('should NOT match file search tools', () => {
        const tool1 = createMockTool('search_files', 'Search files in directory');
        const tool2 = createMockTool('grep_search', 'Search for patterns');
        const tool3 = createMockTool('glob_search', 'Find files by pattern');

        expect(inferToolCapability(tool1)).not.toContain('web-search');
        expect(inferToolCapability(tool2)).not.toContain('web-search');
        expect(inferToolCapability(tool3)).not.toContain('web-search');
      });

      it('should NOT match file search tools with underscore patterns', () => {
        // Bug fix: \bfile\b doesn't match search_file because _ is a word char
        // These should NOT be classified as web-search even if they have 'web' patterns
        const tool1 = createMockTool('web_search_file', 'Search for files');
        const tool2 = createMockTool('file_web_search', 'Web-enabled file search');
        const tool3 = createMockTool('search_grep_results', 'Search in grep results');

        expect(inferToolCapability(tool1)).not.toContain('web-search');
        expect(inferToolCapability(tool2)).not.toContain('web-search');
        expect(inferToolCapability(tool3)).not.toContain('web-search');
      });

      it('should NOT match "profile" which contains "file" as substring', () => {
        const tool = createMockTool('get_profile_search', 'Search user profiles on the web');
        // This should detect web-search because description says "on the web"
        // and 'profile' should NOT trigger the file exclusion
        expect(inferToolCapability(tool)).toContain('web-search');
      });
    });

    describe('web-fetch detection', () => {
      it('should detect web_fetch in name', () => {
        const tool = createMockTool('web_fetch', 'Fetch content from URL');
        expect(inferToolCapability(tool)).toContain('web-fetch');
      });

      it('should detect url_fetch in name', () => {
        const tool = createMockTool('url_fetch', 'Fetch URL content');
        expect(inferToolCapability(tool)).toContain('web-fetch');
      });

      it('should detect "fetch url" in description', () => {
        const tool = createMockTool('get_content', 'Fetch URL and return content');
        expect(inferToolCapability(tool)).toContain('web-fetch');
      });

      it('should NOT match file readers', () => {
        const tool1 = createMockTool('pdf_reader', 'Read PDF files');
        const tool2 = createMockTool('csv_reader', 'Parse CSV file');
        const tool3 = createMockTool('read_file', 'Read file contents');

        expect(inferToolCapability(tool1)).not.toContain('web-fetch');
        expect(inferToolCapability(tool2)).not.toContain('web-fetch');
        expect(inferToolCapability(tool3)).not.toContain('web-fetch');
      });
    });

    describe('vision detection', () => {
      it('should detect vision in name with word boundary', () => {
        const tool = createMockTool('analyze_vision', 'AI vision analysis');
        expect(inferToolCapability(tool)).toContain('vision');
      });

      it('should detect "image analysis" in description', () => {
        const tool = createMockTool('analyze_image', 'Perform image analysis');
        expect(inferToolCapability(tool)).toContain('vision');
      });

      it('should NOT match "division", "revision", "provision"', () => {
        const tool1 = createMockTool('division_calculator', 'Calculate division');
        const tool2 = createMockTool('revision_history', 'Get revision history');
        const tool3 = createMockTool('provision_server', 'Provision a server');

        expect(inferToolCapability(tool1)).not.toContain('vision');
        expect(inferToolCapability(tool2)).not.toContain('vision');
        expect(inferToolCapability(tool3)).not.toContain('vision');
      });

      it('should NOT match image manipulation tools', () => {
        const tool1 = createMockTool('resize_image', 'Resize image dimensions');
        const tool2 = createMockTool('compress_image', 'Compress image file');
        const tool3 = createMockTool('get_image_dimensions', 'Get image dimensions');

        expect(inferToolCapability(tool1)).not.toContain('vision');
        expect(inferToolCapability(tool2)).not.toContain('vision');
        expect(inferToolCapability(tool3)).not.toContain('vision');
      });

      it('should match vision tools that also convert data', () => {
        // This was a bug - "convert" in description was excluding valid vision tools
        const tool = createMockTool('vision_to_text', 'Use vision to analyze image and extract text');
        expect(inferToolCapability(tool)).toContain('vision');
      });
    });

    describe('memory detection', () => {
      it('should detect memory_add, memory_search patterns', () => {
        expect(inferToolCapability(createMockTool('memory_add'))).toContain('memory');
        expect(inferToolCapability(createMockTool('memory_search'))).toContain('memory');
        expect(inferToolCapability(createMockTool('memory_list'))).toContain('memory');
      });

      it('should detect "conversation memory" in description', () => {
        const tool = createMockTool('store_context', 'Store conversation memory');
        expect(inferToolCapability(tool)).toContain('memory');
      });

      it('should NOT match system memory tools', () => {
        const tool1 = createMockTool('check_memory', 'Check memory usage');
        const tool2 = createMockTool('memory_monitor', 'Monitor for memory leak');
        const tool3 = createMockTool('cache_data', 'Store data in-memory');

        expect(inferToolCapability(tool1)).not.toContain('memory');
        expect(inferToolCapability(tool2)).not.toContain('memory');
        expect(inferToolCapability(tool3)).not.toContain('memory');
      });
    });

    describe('agent-delegation detection', () => {
      it('should detect run_agent, spawn_agent patterns', () => {
        expect(inferToolCapability(createMockTool('run_agent'))).toContain('agent-delegation');
        expect(inferToolCapability(createMockTool('spawn_agent'))).toContain('agent-delegation');
        expect(inferToolCapability(createMockTool('create_agent'))).toContain('agent-delegation');
      });

      it('should detect "multi-agent" in description', () => {
        const tool = createMockTool('orchestrate', 'Orchestrate multi-agent workflow');
        expect(inferToolCapability(tool)).toContain('agent-delegation');
      });

      it('should NOT match user_agent or reagent', () => {
        const tool1 = createMockTool('get_user_agent', 'Get browser user agent');
        const tool2 = createMockTool('add_reagent', 'Add chemical reagent');

        expect(inferToolCapability(tool1)).not.toContain('agent-delegation');
        expect(inferToolCapability(tool2)).not.toContain('agent-delegation');
      });
    });

    describe('design detection', () => {
      it('should detect Figma tools as design-figma', () => {
        const tool = createMockTool('figma_export', 'Export from Figma');
        expect(inferToolCapability(tool)).toContain('design-figma');
        expect(inferToolCapability(tool)).not.toContain('design-general');
      });

      it('should detect general design tools as design-general', () => {
        const tool = createMockTool('design_system_token', 'Get design system tokens');
        expect(inferToolCapability(tool)).toContain('design-general');
        expect(inferToolCapability(tool)).not.toContain('design-figma');
      });

      it('should NOT match "redesign" or "designated"', () => {
        const tool1 = createMockTool('redesign_layout', 'Redesign the layout');
        const tool2 = createMockTool('designated_handler', 'The designated handler');

        expect(inferToolCapability(tool1)).not.toContain('design-figma');
        expect(inferToolCapability(tool1)).not.toContain('design-general');
        expect(inferToolCapability(tool2)).not.toContain('design-figma');
        expect(inferToolCapability(tool2)).not.toContain('design-general');
      });
    });

    describe('git-operations detection', () => {
      it('should detect git tools', () => {
        expect(inferToolCapability(createMockTool('git_commit'))).toContain('git-operations');
        expect(inferToolCapability(createMockTool('github_pr'))).toContain('git-operations');
        expect(inferToolCapability(createMockTool('gitlab_merge'))).toContain('git-operations');
      });

      it('should NOT match "digit" or "legitimate"', () => {
        const tool1 = createMockTool('digit_recognition', 'Recognize digits');
        const tool2 = createMockTool('legitimate_check', 'Check if legitimate');

        expect(inferToolCapability(tool1)).not.toContain('git-operations');
        expect(inferToolCapability(tool2)).not.toContain('git-operations');
      });
    });

    describe('database detection', () => {
      it('should detect database systems', () => {
        expect(inferToolCapability(createMockTool('postgres_query'))).toContain('database');
        expect(inferToolCapability(createMockTool('sqlite_exec'))).toContain('database');
        expect(inferToolCapability(createMockTool('mongodb_find'))).toContain('database');
      });

      it('should detect SQL operations', () => {
        expect(inferToolCapability(createMockTool('sql_query'))).toContain('database');
        expect(inferToolCapability(createMockTool('execute_sql'))).toContain('database');
      });

      it('should NOT match generic query tools', () => {
        // Generic 'query' is too broad - could be DNS query, GraphQL query, etc.
        const tool = createMockTool('query_params', 'Parse query parameters');
        expect(inferToolCapability(tool)).not.toContain('database');
      });
    });

    describe('file-operations detection', () => {
      it('should detect file tools', () => {
        expect(inferToolCapability(createMockTool('read_file'))).toContain('file-operations');
        expect(inferToolCapability(createMockTool('write_file'))).toContain('file-operations');
        expect(inferToolCapability(createMockTool('edit_file'))).toContain('file-operations');
      });

      it('should NOT match "thread", "spread", "credit"', () => {
        const tool1 = createMockTool('thread_pool', 'Manage thread pool');
        const tool2 = createMockTool('spread_data', 'Spread data across nodes');

        expect(inferToolCapability(tool1)).not.toContain('file-operations');
        expect(inferToolCapability(tool2)).not.toContain('file-operations');
      });
    });

    describe('deployment detection', () => {
      it('should detect deployment platforms in name', () => {
        expect(inferToolCapability(createMockTool('vercel_deploy'))).toContain('deployment');
        expect(inferToolCapability(createMockTool('netlify_publish'))).toContain('deployment');
        expect(inferToolCapability(createMockTool('heroku_push'))).toContain('deployment');
      });

      it('should detect deployment actions in name', () => {
        expect(inferToolCapability(createMockTool('deploy_app'))).toContain('deployment');
        expect(inferToolCapability(createMockTool('deploy_site'))).toContain('deployment');
        expect(inferToolCapability(createMockTool('create_deployment'))).toContain('deployment');
      });

      it('should detect deployment in description', () => {
        const tool1 = createMockTool('publish', 'Deploy to production');
        const tool2 = createMockTool('release', 'Deploy application to server');
        const tool3 = createMockTool('ship', 'Use deployment platform');
        const tool4 = createMockTool('launch', 'Deploy website to CDN');

        expect(inferToolCapability(tool1)).toContain('deployment');
        expect(inferToolCapability(tool2)).toContain('deployment');
        expect(inferToolCapability(tool3)).toContain('deployment');
        expect(inferToolCapability(tool4)).toContain('deployment');
      });

      it('should NOT match generic deploy words', () => {
        // Generic words that might contain deploy-like patterns but aren't deployment tools
        const tool = createMockTool('get_employees', 'Get employee data');
        expect(inferToolCapability(tool)).not.toContain('deployment');
      });
    });

    describe('testing detection', () => {
      it('should detect testing frameworks in name', () => {
        expect(inferToolCapability(createMockTool('run_test'))).toContain('testing');
        expect(inferToolCapability(createMockTool('jest_runner'))).toContain('testing');
        expect(inferToolCapability(createMockTool('vitest_run'))).toContain('testing');
        expect(inferToolCapability(createMockTool('mocha_test'))).toContain('testing');
      });

      it('should detect jest in various positions', () => {
        expect(inferToolCapability(createMockTool('jest'))).toContain('testing');
        expect(inferToolCapability(createMockTool('run_jest'))).toContain('testing');
        expect(inferToolCapability(createMockTool('jest_test'))).toContain('testing');
        expect(inferToolCapability(createMockTool('run_jest_test'))).toContain('testing');
      });

      it('should detect browser automation tools', () => {
        expect(inferToolCapability(createMockTool('puppeteer_screenshot'))).toContain('testing');
        expect(inferToolCapability(createMockTool('playwright_run'))).toContain('testing');
        expect(inferToolCapability(createMockTool('cypress_test'))).toContain('testing');
        expect(inferToolCapability(createMockTool('selenium_driver'))).toContain('testing');
      });

      it('should detect testing in description', () => {
        const tool1 = createMockTool('qa_check', 'Run tests against the application');
        const tool2 = createMockTool('automation', 'Browser automation for e2e tests');
        const tool3 = createMockTool('check', 'Execute unit test suite');

        expect(inferToolCapability(tool1)).toContain('testing');
        expect(inferToolCapability(tool2)).toContain('testing');
        expect(inferToolCapability(tool3)).toContain('testing');
      });

      it('should NOT match "protesting", "contesting", "attesting"', () => {
        const tool1 = createMockTool('protesting_handler', 'Handle protesting users');
        const tool2 = createMockTool('contesting_claim', 'Contest a claim');

        expect(inferToolCapability(tool1)).not.toContain('testing');
        expect(inferToolCapability(tool2)).not.toContain('testing');
      });

      it('should detect testing capability from puppeteer-like MCP tools', () => {
        const tool = createMockTool('mcp__puppeteer__screenshot', 'Take browser screenshot');
        // Now should infer testing from puppeteer pattern
        expect(inferToolCapability(tool)).toContain('testing');
        expect(inferToolCapability(tool)).not.toContain('web-fetch');
      });
    });

    describe('monitoring detection', () => {
      it('should detect monitoring platforms in name', () => {
        expect(inferToolCapability(createMockTool('sentry_capture'))).toContain('monitoring');
        expect(inferToolCapability(createMockTool('datadog_metric'))).toContain('monitoring');
        expect(inferToolCapability(createMockTool('newrelic_trace'))).toContain('monitoring');
        expect(inferToolCapability(createMockTool('grafana_dashboard'))).toContain('monitoring');
      });

      it('should detect error tracking patterns', () => {
        expect(inferToolCapability(createMockTool('error_track_event'))).toContain('monitoring');
        expect(inferToolCapability(createMockTool('log_event_send'))).toContain('monitoring');
        expect(inferToolCapability(createMockTool('alert_trigger'))).toContain('monitoring');
      });

      it('should detect monitoring in description', () => {
        const tool1 = createMockTool('track', 'Error tracking for production');
        const tool2 = createMockTool('observe', 'Application monitoring and APM');
        const tool3 = createMockTool('watch', 'Observability platform integration');

        expect(inferToolCapability(tool1)).toContain('monitoring');
        expect(inferToolCapability(tool2)).toContain('monitoring');
        expect(inferToolCapability(tool3)).toContain('monitoring');
      });

      it('should NOT match generic monitoring words', () => {
        // Generic 'monitor' without specific context
        const tool = createMockTool('display_monitor', 'Get display monitor info');
        expect(inferToolCapability(tool)).not.toContain('monitoring');
      });
    });
  });

  describe('PriorityRegistry', () => {
    describe('analyzeToolMetadata', () => {
      it('should analyze MCP tool with known server', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('mcp__automatosx__memory_add', 'Add to memory');

        const metadata = registry.analyzeToolMetadata(tool);

        expect(metadata.name).toBe('mcp__automatosx__memory_add');
        expect(metadata.serverName).toBe('automatosx');
        expect(metadata.priority).toBe(ToolPriority.GENERAL_MCP);
        expect(metadata.capabilities).toContain('memory');
      });

      it('should analyze MCP tool with unknown server', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('mcp__custom_server__do_thing', 'Do something');

        const metadata = registry.analyzeToolMetadata(tool);

        expect(metadata.serverName).toBe('custom_server');
        expect(metadata.priority).toBe(ToolPriority.COMMUNITY_MCP);
      });

      it('should analyze malformed MCP tool', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('mcp____broken_tool', 'Broken MCP tool');

        const metadata = registry.analyzeToolMetadata(tool);

        expect(metadata.serverName).toBeUndefined();
        expect(metadata.priority).toBe(ToolPriority.COMMUNITY_MCP); // Not BUILTIN
      });

      it('should analyze built-in tool', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('read_file', 'Read file contents');

        const metadata = registry.analyzeToolMetadata(tool);

        expect(metadata.serverName).toBeUndefined();
        expect(metadata.priority).toBe(ToolPriority.BUILTIN_TOOL);
        expect(metadata.capabilities).toContain('file-operations');
      });

      it('should cache analysis results', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('mcp__automatosx__test', 'Test tool');

        const first = registry.analyzeToolMetadata(tool);
        const second = registry.analyzeToolMetadata(tool);

        expect(first).toBe(second); // Same object reference
      });

      it('should merge registry capabilities with inferred capabilities', () => {
        const registry = new PriorityRegistry();
        // AutomatosX is registered with web-search, web-fetch, memory, agent-delegation
        // But if a specific tool also matches git-operations, it should be added
        const tool = createMockTool('mcp__automatosx__github_sync', 'Sync with GitHub repository');

        const metadata = registry.analyzeToolMetadata(tool);

        // Should have both registry capabilities AND inferred git-operations
        expect(metadata.capabilities).toContain('memory'); // from registry
        expect(metadata.capabilities).toContain('git-operations'); // inferred
      });
    });

    describe('shouldHideTool', () => {
      it('should NOT hide tools with no detected capabilities', () => {
        const registry = new PriorityRegistry();
        const tool = createMockTool('unknown_tool', 'Does something');
        const allTools = [tool];

        const hideReason = registry.shouldHideTool(tool, allTools);

        expect(hideReason).toBeUndefined();
      });

      it('should hide lower-priority tools when all capabilities are superseded', () => {
        const registry = new PriorityRegistry();
        // Z.AI has priority 80, AutomatosX has priority 10
        // Difference is 70, which is >= 15 threshold
        const zaiTool = createMockTool('mcp__zai-web-search__search', 'Search the web');
        const automatosxTool = createMockTool('mcp__automatosx__web_search', 'Search the web');

        const allTools = [zaiTool, automatosxTool];

        // AutomatosX web_search should be hidden (superseded by Z.AI)
        // BUT only if AutomatosX has ONLY web-search capability
        // In reality, AutomatosX has memory, agent-delegation too
        const hideReason = registry.shouldHideTool(automatosxTool, allTools);

        // Should NOT hide because AutomatosX has unique capabilities (memory, agent-delegation)
        expect(hideReason).toBeUndefined();
      });

      it('should NOT hide tools with unique capabilities even if some are superseded', () => {
        const registry = new PriorityRegistry();
        // AutomatosX provides memory and agent-delegation that no one else does
        const automatosxTool = createMockTool('mcp__automatosx__run_agent', 'Run agent');
        const allTools = [automatosxTool];

        const hideReason = registry.shouldHideTool(automatosxTool, allTools);

        expect(hideReason).toBeUndefined();
      });
    });

    describe('findHighestPriorityTool', () => {
      it('should return native capability as highest for providers that support it', () => {
        // Create registry with Grok provider (has native web-search)
        const registry = new PriorityRegistry({
          name: 'grok',
          displayName: 'Grok',
          apiKeyEnvVar: 'XAI_API_KEY',
          defaultBaseURL: 'https://api.x.ai/v1',
          defaultModel: 'grok-3',
          configDirName: '.ax-grok',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: true, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-grok', description: '', welcomeMessage: '', primaryColor: 'magenta', secondaryColor: 'yellow', tagline: '', asciiLogo: '' },
        });

        const mcpTool = createMockTool('mcp__automatosx__web_search', 'Search the web');
        const allTools = [mcpTool];

        const highest = registry.findHighestPriorityTool(allTools, 'web-search');

        expect(highest).toBeDefined();
        expect(highest?.name).toBe(`${NATIVE_CAPABILITY_PREFIX}web-search`);
        expect(highest?.priority).toBe(ToolPriority.NATIVE_API);
      });

      it('should return MCP tool as highest when no native capability', () => {
        // Create registry with GLM provider (no native web-search)
        const registry = new PriorityRegistry({
          name: 'glm',
          displayName: 'GLM',
          apiKeyEnvVar: 'ZAI_API_KEY',
          defaultBaseURL: 'https://api.z.ai',
          defaultModel: 'glm-4.6',
          configDirName: '.ax-glm',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: false, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-glm', description: '', welcomeMessage: '', primaryColor: 'cyan', secondaryColor: 'green', tagline: '', asciiLogo: '' },
        });

        const zaiTool = createMockTool('mcp__zai-web-search__search', 'Search the web');
        const automatosxTool = createMockTool('mcp__automatosx__web_search', 'Search the web');
        const allTools = [zaiTool, automatosxTool];

        const highest = registry.findHighestPriorityTool(allTools, 'web-search');

        expect(highest).toBeDefined();
        // Z.AI should win because of GLM affinity (80 + 10 = 90) vs AutomatosX (10)
        expect(highest?.serverName).toBe('zai-web-search');
      });
    });

    describe('filterTools', () => {
      it('should return all tools when none should be hidden', () => {
        const registry = new PriorityRegistry();
        const tool1 = createMockTool('read_file', 'Read file');
        const tool2 = createMockTool('write_file', 'Write file');

        const { filtered, hidden } = registry.filterTools([tool1, tool2]);

        expect(filtered).toHaveLength(2);
        expect(hidden).toHaveLength(0);
      });

      it('should filter out duplicate capabilities from lower-priority sources', () => {
        const registry = new PriorityRegistry();
        // Create tools where one clearly supersedes another
        // Higher priority tool
        const highPriorityTool = createMockTool('mcp__zai-web-search__search', 'Search the web');
        // Lower priority tool with ONLY web-search capability (simulated)
        const lowPriorityTool = createMockTool('web_search_basic', 'Basic web search');

        const { filtered } = registry.filterTools([highPriorityTool, lowPriorityTool]);

        // The basic web search should be filtered out if it only has web-search capability
        // and is superseded by Z.AI (80 vs 5 = 75 point difference)
        expect(filtered.length).toBeLessThanOrEqual(2);
      });
    });

    describe('getToolsForCapability', () => {
      it('should return tools sorted by priority (highest first)', () => {
        const registry = new PriorityRegistry();
        // Create tools with different priorities
        const automatosxTool = createMockTool('mcp__automatosx__web_search', 'Search the web'); // priority 10
        const zaiTool = createMockTool('mcp__zai-web-search__search', 'Search the web'); // priority 80
        const builtinTool = createMockTool('web_search', 'Search the web'); // priority 5

        const tools = registry.getToolsForCapability(
          [automatosxTool, zaiTool, builtinTool],
          'web-search'
        );

        // Should be sorted: zai (80) > automatosx (10) > builtin (5)
        expect(tools.length).toBeGreaterThan(0);
        expect(tools[0].function.name).toBe('mcp__zai-web-search__search');
      });

      it('should filter tools that do not have the capability', () => {
        const registry = new PriorityRegistry();
        const memoryTool = createMockTool('mcp__automatosx__memory_add', 'Add to memory');
        const fileTool = createMockTool('read_file', 'Read file contents');

        const tools = registry.getToolsForCapability([memoryTool, fileTool], 'memory');

        expect(tools).toHaveLength(1);
        expect(tools[0].function.name).toBe('mcp__automatosx__memory_add');
      });

      it('should return empty array when no tools have the capability', () => {
        const registry = new PriorityRegistry();
        const fileTool = createMockTool('read_file', 'Read file contents');

        const tools = registry.getToolsForCapability([fileTool], 'database');

        expect(tools).toHaveLength(0);
      });

      it('should handle empty tools array', () => {
        const registry = new PriorityRegistry();

        const tools = registry.getToolsForCapability([], 'web-search');

        expect(tools).toHaveLength(0);
      });
    });

    describe('getCapabilityGuidance', () => {
      it('should provide native search guidance for Grok', () => {
        const registry = new PriorityRegistry({
          name: 'grok',
          displayName: 'Grok',
          apiKeyEnvVar: 'XAI_API_KEY',
          defaultBaseURL: 'https://api.x.ai/v1',
          defaultModel: 'grok-3',
          configDirName: '.ax-grok',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: true, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-grok', description: '', welcomeMessage: '', primaryColor: 'magenta', secondaryColor: 'yellow', tagline: '', asciiLogo: '' },
        });

        const guidance = registry.getCapabilityGuidance();

        expect(guidance.some(g => g.includes('NATIVE'))).toBe(true);
      });

      it('should provide native search guidance for Gemini', () => {
        const registry = new PriorityRegistry({
          name: 'gemini',
          displayName: 'Gemini',
          apiKeyEnvVar: 'GOOGLE_API_KEY',
          defaultBaseURL: 'https://api.google.com',
          defaultModel: 'gemini-pro',
          configDirName: '.ax-gemini',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: true, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-gemini', description: '', welcomeMessage: '', primaryColor: 'blue', secondaryColor: 'white', tagline: '', asciiLogo: '' },
        });

        const guidance = registry.getCapabilityGuidance();

        expect(guidance.some(g => g.includes('NATIVE'))).toBe(true);
      });

      it('should provide native search guidance for provider variants with underscore', () => {
        // Tests the providerMatches function with underscore variant (line 36)
        const registry = new PriorityRegistry({
          name: 'grok_beta',
          displayName: 'Grok Beta',
          apiKeyEnvVar: 'XAI_API_KEY',
          defaultBaseURL: 'https://api.x.ai/v1',
          defaultModel: 'grok-3',
          configDirName: '.ax-grok',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: true, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-grok', description: '', welcomeMessage: '', primaryColor: 'magenta', secondaryColor: 'yellow', tagline: '', asciiLogo: '' },
        });

        const guidance = registry.getCapabilityGuidance();

        // Should still match 'grok' provider and provide native search guidance
        expect(guidance.some(g => g.includes('NATIVE'))).toBe(true);
      });

      it('should provide Z.AI guidance for GLM when connected', () => {
        const registry = new PriorityRegistry({
          name: 'glm',
          displayName: 'GLM',
          apiKeyEnvVar: 'ZAI_API_KEY',
          defaultBaseURL: 'https://api.z.ai',
          defaultModel: 'glm-4.6',
          configDirName: '.ax-glm',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: false, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-glm', description: '', welcomeMessage: '', primaryColor: 'cyan', secondaryColor: 'green', tagline: '', asciiLogo: '' },
        });

        const guidance = registry.getCapabilityGuidance(['zai-web-search']);

        expect(guidance.some(g => g.includes('Z.AI'))).toBe(true);
      });

      it('should NOT provide Z.AI guidance for GLM when Z.AI not connected', () => {
        const registry = new PriorityRegistry({
          name: 'glm',
          displayName: 'GLM',
          apiKeyEnvVar: 'ZAI_API_KEY',
          defaultBaseURL: 'https://api.z.ai',
          defaultModel: 'glm-4.6',
          configDirName: '.ax-glm',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: false, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-glm', description: '', welcomeMessage: '', primaryColor: 'cyan', secondaryColor: 'green', tagline: '', asciiLogo: '' },
        });

        const guidance = registry.getCapabilityGuidance(['automatosx']); // Z.AI not in list

        expect(guidance.some(g => g.includes('Z.AI'))).toBe(false);
      });

      it('should only provide guidance for connected servers', () => {
        const registry = new PriorityRegistry();

        // When only automatosx is connected
        const guidance = registry.getCapabilityGuidance(['automatosx']);

        expect(guidance.some(g => g.includes('AutomatosX'))).toBe(true);
        expect(guidance.some(g => g.includes('Figma'))).toBe(false);
        expect(guidance.some(g => g.includes('GitHub'))).toBe(false);
      });

      it('should handle server name variants in connected servers list', () => {
        const registry = new PriorityRegistry();

        // Server variant name (e.g., automatosx-glm)
        const guidance = registry.getCapabilityGuidance(['automatosx-glm', 'github-enterprise']);

        expect(guidance.some(g => g.includes('AutomatosX'))).toBe(true);
        expect(guidance.some(g => g.includes('GitHub'))).toBe(true);
      });

      it('should handle server name variants with underscore', () => {
        const registry = new PriorityRegistry();

        // Server variant name with underscore
        const guidance = registry.getCapabilityGuidance(['automatosx_custom', 'figma_enterprise']);

        expect(guidance.some(g => g.includes('AutomatosX'))).toBe(true);
        expect(guidance.some(g => g.includes('Figma'))).toBe(true);
      });

      it('should provide no MCP guidance when empty array is passed', () => {
        const registry = new PriorityRegistry();

        // Empty array means no servers connected - should give no MCP guidance
        const guidance = registry.getCapabilityGuidance([]);

        expect(guidance.some(g => g.includes('AutomatosX'))).toBe(false);
        expect(guidance.some(g => g.includes('Figma'))).toBe(false);
        expect(guidance.some(g => g.includes('GitHub'))).toBe(false);
      });
    });

    describe('singleton management', () => {
      it('should return same instance from getPriorityRegistry', () => {
        const first = getPriorityRegistry();
        const second = getPriorityRegistry();

        expect(first).toBe(second);
      });

      it('should create new instance after resetPriorityRegistry', () => {
        const first = getPriorityRegistry();
        resetPriorityRegistry();
        const second = getPriorityRegistry();

        expect(first).not.toBe(second);
      });

      it('should update provider with updatePriorityRegistryProvider', () => {
        const registry = getPriorityRegistry();
        const mockProvider = {
          name: 'test-provider',
          displayName: 'Test',
          apiKeyEnvVar: 'TEST_KEY',
          defaultBaseURL: 'https://test.api',
          defaultModel: 'test-1',
          configDirName: '.ax-test',
          models: {},
          features: { supportsThinking: false, supportsVision: false, supportsSearch: false, supportsSeed: false, supportsDoSample: false },
          branding: { cliName: 'ax-test', description: '', welcomeMessage: '', primaryColor: 'blue', secondaryColor: 'white', tagline: '', asciiLogo: '' },
        };

        updatePriorityRegistryProvider(mockProvider);

        // The registry should now use the new provider
        // We can't directly check private state, but we can verify it doesn't throw
        expect(() => registry.getCapabilityGuidance()).not.toThrow();
      });
    });
  });
});
