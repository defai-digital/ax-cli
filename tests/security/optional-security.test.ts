/**
 * Security Tests: Optional Security Configuration
 *
 * Tests that security hardening features are optional and disabled by default.
 * Enterprise customers can enable them manually via settings.
 *
 * NOTE: These tests verify the schema validation and configuration structure.
 * The actual bash command execution behavior is tested in command-injection.test.ts
 */

import { describe, it, expect } from 'vitest';
import { UserSettingsSchema, type UserSettings } from '../../src/schemas/settings-schemas.js';

describe('Optional Security Configuration', () => {
  describe('SecuritySettings Schema Validation', () => {
    it('should accept security settings with all flags enabled', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
          enableSSRFProtection: true,
          enableErrorSanitization: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security?.enableCommandWhitelist).toBe(true);
        expect(result.data.security?.enableSSRFProtection).toBe(true);
        expect(result.data.security?.enableErrorSanitization).toBe(true);
      }
    });

    it('should accept security settings with all flags disabled (default)', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: false,
          enableSSRFProtection: false,
          enableErrorSanitization: false,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security?.enableCommandWhitelist).toBe(false);
        expect(result.data.security?.enableSSRFProtection).toBe(false);
        expect(result.data.security?.enableErrorSanitization).toBe(false);
      }
    });

    it('should accept partial security settings (only some flags set)', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
          // Other flags omitted
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security?.enableCommandWhitelist).toBe(true);
        expect(result.data.security?.enableSSRFProtection).toBeUndefined();
        expect(result.data.security?.enableErrorSanitization).toBeUndefined();
      }
    });

    it('should accept empty security settings object', () => {
      const settings: UserSettings = {
        security: {},
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security).toBeDefined();
        expect(result.data.security?.enableCommandWhitelist).toBeUndefined();
      }
    });

    it('should accept settings with no security field (backward compatibility)', () => {
      const settings: UserSettings = {
        apiKey: 'test-key',
        defaultModel: 'glm-4.6',
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security).toBeUndefined();
      }
    });

    it('should reject invalid security settings (non-boolean values)', () => {
      const settings = {
        security: {
          enableCommandWhitelist: 'yes', // Should be boolean
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(false);
    });
  });

  describe('Default Behavior Documentation', () => {
    it('should document that enableCommandWhitelist defaults to false', () => {
      // When undefined, the setting should default to false
      const settings: UserSettings = {};
      const shouldEnforce = settings.security?.enableCommandWhitelist ?? false;

      expect(shouldEnforce).toBe(false);
    });

    it('should document that enableSSRFProtection defaults to false', () => {
      // When undefined, the setting should default to false
      const settings: UserSettings = {};
      const shouldEnforce = settings.security?.enableSSRFProtection ?? false;

      expect(shouldEnforce).toBe(false);
    });

    it('should document that enableErrorSanitization defaults to false', () => {
      // When undefined, the setting should default to false
      const settings: UserSettings = {};
      const shouldEnforce = settings.security?.enableErrorSanitization ?? false;

      expect(shouldEnforce).toBe(false);
    });

    it('should document enterprise mode (all hardening enabled)', () => {
      const enterpriseSettings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
          enableSSRFProtection: true,
          enableErrorSanitization: true,
        },
      };

      expect(enterpriseSettings.security?.enableCommandWhitelist).toBe(true);
      expect(enterpriseSettings.security?.enableSSRFProtection).toBe(true);
      expect(enterpriseSettings.security?.enableErrorSanitization).toBe(true);
    });
  });

  describe('Configuration Flexibility', () => {
    it('should allow enabling only command whitelist', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should allow enabling only SSRF protection', () => {
      const settings: UserSettings = {
        security: {
          enableSSRFProtection: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should allow enabling only error sanitization', () => {
      const settings: UserSettings = {
        security: {
          enableErrorSanitization: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });

    it('should allow mixing enabled and disabled flags', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
          enableSSRFProtection: false,
          enableErrorSanitization: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security?.enableCommandWhitelist).toBe(true);
        expect(result.data.security?.enableSSRFProtection).toBe(false);
        expect(result.data.security?.enableErrorSanitization).toBe(true);
      }
    });
  });

  describe('Integration with Other Settings', () => {
    it('should work alongside other user settings', () => {
      const settings: UserSettings = {
        apiKey: 'test-api-key',
        baseURL: 'https://api.example.com',
        defaultModel: 'glm-4.6',
        maxTokens: 4096,
        temperature: 0.7,
        security: {
          enableCommandWhitelist: true,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apiKey).toBe('test-api-key');
        expect(result.data.defaultModel).toBe('glm-4.6');
        expect(result.data.security?.enableCommandWhitelist).toBe(true);
      }
    });

    it('should not interfere with optional fields', () => {
      const settings: UserSettings = {
        security: {
          enableCommandWhitelist: true,
        },
        confirmations: {
          fileOperations: false,
          bashCommands: false,
        },
      };

      const result = UserSettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.security?.enableCommandWhitelist).toBe(true);
        expect(result.data.confirmations?.fileOperations).toBe(false);
      }
    });
  });
});
