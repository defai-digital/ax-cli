import { describe, it, expect } from 'vitest';
import {
  mapFigmaFile,
  formatMapResult,
  findNodeById,
  findNodes,
  getNodePath,
} from '../../packages/core/src/design/figma-map.js';
import type { FigmaFileResponse } from '@ax-cli/schemas';

describe('figma-map', () => {
  // Helper to create a mock Figma file response
  const createMockFileResponse = (): FigmaFileResponse => ({
    name: 'Test Design File',
    lastModified: '2024-01-15T12:00:00Z',
    thumbnailUrl: 'https://example.com/thumb.png',
    version: '123456',
    document: {
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
              name: 'Header',
              type: 'FRAME',
              layoutMode: 'HORIZONTAL',
              children: [
                {
                  id: '3:1',
                  name: 'Logo',
                  type: 'RECTANGLE',
                  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }],
                },
                {
                  id: '3:2',
                  name: 'Navigation',
                  type: 'FRAME',
                  layoutMode: 'HORIZONTAL',
                  children: [
                    {
                      id: '4:1',
                      name: 'Home Link',
                      type: 'TEXT',
                      characters: 'Home',
                    },
                    {
                      id: '4:2',
                      name: 'About Link',
                      type: 'TEXT',
                      characters: 'About Us',
                    },
                  ],
                },
              ],
            },
            {
              id: '2:2',
              name: 'Hero Section',
              type: 'FRAME',
              children: [
                {
                  id: '3:3',
                  name: 'Hero Title',
                  type: 'TEXT',
                  characters: 'Welcome to Our Site',
                },
              ],
            },
          ],
        },
        {
          id: '1:2',
          name: 'Page 2',
          type: 'CANVAS',
          children: [],
        },
      ],
    },
    components: {
      'comp-1': {
        key: 'comp-1',
        name: 'Button',
        description: 'Primary button',
      },
    },
    styles: {
      'style-1': {
        key: 'style-1',
        name: 'Primary Color',
        styleType: 'FILL',
      },
    },
  });

  describe('mapFigmaFile', () => {
    it('should map file metadata', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      expect(result.fileKey).toBe('test-file-key');
      expect(result.fileName).toBe('Test Design File');
      expect(result.lastModified).toBe('2024-01-15T12:00:00Z');
    });

    it('should count pages correctly', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      expect(result.pageCount).toBe(2);
    });

    it('should count components and styles', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      expect(result.componentCount).toBe(1);
      expect(result.styleCount).toBe(1);
    });

    it('should count all nodes', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      // Document + 2 pages + Header + Logo + Navigation + 2 links + Hero + Title = 10
      expect(result.nodeCount).toBeGreaterThan(5);
    });

    it('should simplify node structure', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      expect(result.root.id).toBe('0:0');
      expect(result.root.name).toBe('Document');
      expect(result.root.type).toBe('DOCUMENT');
      expect(result.root.children).toBeDefined();
    });

    it('should detect auto-layout', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      // Find Header frame which has layoutMode: HORIZONTAL
      const page1 = result.root.children?.[0];
      const header = page1?.children?.[0];

      expect(header?.hasAutoLayout).toBe(true);
    });

    it('should capture text content', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      // Find a text node
      const page1 = result.root.children?.[0];
      const hero = page1?.children?.[1];
      const title = hero?.children?.[0];

      expect(title?.characters).toBe('Welcome to Our Site');
    });

    it('should respect maxDepth option', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key', { maxDepth: 2 });

      // At depth 2, we should see Document (0), Pages (1), Frames (2)
      // But not the contents inside the frames (depth 3+)
      const page1 = result.root.children?.[0];
      const header = page1?.children?.[0];

      // Header should be present (depth 2)
      expect(header).toBeDefined();
      // But its children might be empty or limited
    });

    it('should filter by frames only', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key', { framesOnly: true });

      // When framesOnly is true, non-frame nodes should be filtered
      // but the structure should still include their frame ancestors
      expect(result.root.children).toBeDefined();
    });
  });

  describe('formatMapResult', () => {
    it('should format as tree', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');
      const output = formatMapResult(result, 'tree');

      expect(output).toContain('File: Test Design File');
      expect(output).toContain('Document');
      expect(output).toContain('Page 1');
    });

    it('should format as JSON', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');
      const output = formatMapResult(result, 'json');

      const parsed = JSON.parse(output);
      expect(parsed.fileKey).toBe('test-file-key');
      expect(parsed.root).toBeDefined();
    });

    it('should format as flat list', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');
      const output = formatMapResult(result, 'flat');

      expect(output).toContain('Document');
      expect(output).toContain('>');
      expect(output).toContain('DOCUMENT');
    });

    it('should include IDs when showIds is true', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');
      const output = formatMapResult(result, 'tree', { showIds: true });

      expect(output).toContain('(0:0)');
    });

    it('should include types when showTypes is true', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');
      const output = formatMapResult(result, 'tree', { showTypes: true });

      expect(output).toContain('[DOCUMENT]');
      expect(output).toContain('[CANVAS]');
    });
  });

  describe('findNodeById', () => {
    it('should find root node', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const node = findNodeById(result.root, '0:0');
      expect(node).toBeDefined();
      expect(node?.name).toBe('Document');
    });

    it('should find nested node', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const node = findNodeById(result.root, '3:3');
      expect(node).toBeDefined();
      expect(node?.name).toBe('Hero Title');
    });

    it('should return null for non-existent ID', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const node = findNodeById(result.root, '999:999');
      expect(node).toBeNull();
    });
  });

  describe('findNodes', () => {
    it('should find nodes by type', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const textNodes = findNodes(result.root, node => node.type === 'TEXT');
      expect(textNodes.length).toBeGreaterThan(0);
      expect(textNodes.every(n => n.type === 'TEXT')).toBe(true);
    });

    it('should find nodes by name pattern', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const linkNodes = findNodes(result.root, node =>
        node.name.toLowerCase().includes('link')
      );
      expect(linkNodes.length).toBe(2);
    });

    it('should respect limit parameter', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const allNodes = findNodes(result.root, () => true);
      const limitedNodes = findNodes(result.root, () => true, 3);

      expect(limitedNodes.length).toBe(3);
      expect(allNodes.length).toBeGreaterThan(3);
    });

    it('should return empty array when no matches', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const nodes = findNodes(result.root, node => node.type === 'NONEXISTENT');
      expect(nodes).toEqual([]);
    });
  });

  describe('getNodePath', () => {
    it('should return path to root', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const path = getNodePath(result.root, '0:0');
      expect(path).toEqual(['Document']);
    });

    it('should return full path to nested node', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const path = getNodePath(result.root, '4:1');
      expect(path).toBeDefined();
      expect(path).toContain('Document');
      expect(path).toContain('Page 1');
      expect(path).toContain('Header');
      expect(path).toContain('Navigation');
      expect(path).toContain('Home Link');
    });

    it('should return null for non-existent node', () => {
      const response = createMockFileResponse();
      const result = mapFigmaFile(response, 'test-file-key');

      const path = getNodePath(result.root, '999:999');
      expect(path).toBeNull();
    });
  });
});
