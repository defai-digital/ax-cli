import { describe, it, expect } from 'vitest';
import {
  auditDesign,
  formatAuditResult,
  formatAuditSummary,
} from '../../src/design/figma-audit.js';
import type { MapResult, SimplifiedNode } from '../../src/design/types.js';

describe('figma-audit', () => {
  // Helper to create a mock MapResult
  const createMockMapResult = (root: SimplifiedNode): MapResult => ({
    fileKey: 'test-file-key',
    fileName: 'Test File',
    lastModified: new Date().toISOString(),
    pageCount: 1,
    nodeCount: countNodes(root),
    componentCount: 0,
    styleCount: 0,
    root,
  });

  function countNodes(node: SimplifiedNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  }

  describe('auditDesign', () => {
    it('should audit a simple document with no issues', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Page 1',
            type: 'CANVAS',
            children: [
              {
                id: '2:1',
                name: 'Header Section',
                type: 'FRAME',
                hasAutoLayout: true,
              },
            ],
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult);

      expect(result.fileKey).toBe('test-file-key');
      expect(result.summary.nodesAudited).toBe(3);
      expect(result.timestamp).toBeDefined();
    });

    it('should detect generic layer names', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Frame 1',
            type: 'FRAME',
          },
          {
            id: '1:2',
            name: 'Rectangle 123',
            type: 'RECTANGLE',
          },
          {
            id: '1:3',
            name: 'Group 5',
            type: 'GROUP',
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.ruleId === 'layer-naming')).toBe(true);
      expect(result.issues.some(i => i.location.nodeName === 'Frame 1')).toBe(true);
    });

    it('should detect missing auto-layout', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Card',
            type: 'FRAME',
            hasAutoLayout: false, // No auto-layout
            children: [
              { id: '2:1', name: 'Title', type: 'TEXT' },
              { id: '2:2', name: 'Description', type: 'TEXT' },
              { id: '2:3', name: 'Button', type: 'FRAME' },
            ],
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['missing-autolayout'] });

      expect(result.issues.some(i => i.ruleId === 'missing-autolayout')).toBe(true);
    });

    it('should not flag frames with auto-layout', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Card',
            type: 'FRAME',
            hasAutoLayout: true,
            children: [
              { id: '2:1', name: 'Title', type: 'TEXT' },
              { id: '2:2', name: 'Description', type: 'TEXT' },
            ],
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['missing-autolayout'] });

      expect(result.issues.filter(i => i.ruleId === 'missing-autolayout').length).toBe(0);
    });

    it('should detect potential text overflow', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Truncated Text',
            type: 'TEXT',
            characters: 'This is a long text that...',
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['text-overflow'] });

      expect(result.issues.some(i => i.ruleId === 'text-overflow')).toBe(true);
    });

    it('should check naming conventions for components', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'button_primary', // Not PascalCase
            type: 'COMPONENT',
          },
          {
            id: '1:2',
            name: 'PrimaryButton', // PascalCase - OK
            type: 'COMPONENT',
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['naming-convention'] });

      // Should flag button_primary but not PrimaryButton
      const namingIssues = result.issues.filter(i => i.ruleId === 'naming-convention');
      expect(namingIssues.some(i => i.location.nodeName === 'button_primary')).toBe(true);
      expect(namingIssues.some(i => i.location.nodeName === 'PrimaryButton')).toBe(false);
    });

    it('should respect maxDepth option', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Frame 1', // Should be flagged
            type: 'FRAME',
            children: [
              {
                id: '2:1',
                name: 'Frame 2', // Should be flagged (depth 2)
                type: 'FRAME',
                children: [
                  {
                    id: '3:1',
                    name: 'Frame 3', // Should NOT be flagged (depth 3, beyond maxDepth)
                    type: 'FRAME',
                  },
                ],
              },
            ],
          },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'], maxDepth: 2 });

      const flaggedNodes = result.issues.map(i => i.location.nodeName);
      expect(flaggedNodes).toContain('Frame 1');
      expect(flaggedNodes).toContain('Frame 2');
      expect(flaggedNodes).not.toContain('Frame 3');
    });

    it('should only run specified rules', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Frame 1', // Would be flagged by layer-naming
        type: 'FRAME',
        hasAutoLayout: false, // Would be flagged by missing-autolayout
        children: [
          { id: '1:1', name: 'Child 1', type: 'TEXT' },
          { id: '1:2', name: 'Child 2', type: 'TEXT' },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });

      expect(result.summary.rulesRun).toEqual(['layer-naming']);
      expect(result.issues.every(i => i.ruleId === 'layer-naming')).toBe(true);
    });

    it('should exclude specified rules', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Frame 1',
        type: 'FRAME',
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { excludeRules: ['layer-naming'] });

      expect(result.summary.rulesRun).not.toContain('layer-naming');
    });

    it('should calculate pass rate correctly', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          { id: '1:1', name: 'Good Frame', type: 'FRAME' },
          { id: '1:2', name: 'Frame 1', type: 'FRAME' }, // Will be flagged
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });

      expect(result.summary.passRate).toBeLessThan(100);
      expect(result.summary.passRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatAuditResult', () => {
    it('should format audit result as string', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          { id: '1:1', name: 'Frame 1', type: 'FRAME' },
        ],
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult);
      const output = formatAuditResult(result);

      expect(output).toContain('Design Audit Report');
      expect(output).toContain('Summary');
      expect(output).toContain('Nodes audited');
    });

    it('should include issues in output', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Frame 1',
        type: 'FRAME',
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });
      const output = formatAuditResult(result);

      expect(output).toContain('Issues');
      expect(output).toContain('layer-naming');
    });

    it('should show "No issues found" when clean', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Well Named Frame',
        type: 'FRAME',
        hasAutoLayout: true,
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });
      const output = formatAuditResult(result);

      expect(output).toContain('No issues found');
    });
  });

  describe('formatAuditSummary', () => {
    it('should format as compact summary', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult);
      const output = formatAuditSummary(result);

      expect(output).toContain('nodes');
      expect(output).toContain('issues');
      expect(output).toContain('pass rate');
    });

    it('should indicate PASSED when no issues', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Clean Document',
        type: 'DOCUMENT',
      };

      const mapResult = createMockMapResult(root);
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });
      const output = formatAuditSummary(result);

      expect(output).toContain('PASSED');
    });

    it('should indicate status based on severity', () => {
      const root: SimplifiedNode = {
        id: '0:0',
        name: 'Frame 1',
        type: 'FRAME',
      };

      const mapResult = createMockMapResult(root);
      // layer-naming has info severity
      const result = auditDesign(mapResult, { rules: ['layer-naming'] });
      const output = formatAuditSummary(result);

      // Should still pass since info is not error/warning
      expect(output).toContain('PASSED');
    });
  });
});
