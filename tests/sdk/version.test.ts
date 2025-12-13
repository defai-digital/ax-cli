/**
 * Tests for sdk/version.ts
 * Tests version information and compatibility checking
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CLI_VERSION,
  SDK_VERSION,
  SDK_API_VERSION,
  getCLIVersion,
  getSDKVersion,
  getSDKInfo,
  getVersionString,
  isSDKVersionCompatible,
} from '../../packages/core/src/sdk/version.js';

describe('Version Constants', () => {
  describe('CLI_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('SDK_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('SDK_API_VERSION', () => {
    it('should be a positive integer', () => {
      expect(SDK_API_VERSION).toBeTypeOf('number');
      expect(Number.isInteger(SDK_API_VERSION)).toBe(true);
      expect(SDK_API_VERSION).toBeGreaterThan(0);
    });
  });
});

describe('getCLIVersion', () => {
  it('should return version with v prefix', () => {
    const version = getCLIVersion();
    expect(version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(version).toBe(`v${CLI_VERSION}`);
  });
});

describe('getSDKVersion', () => {
  it('should return version with v prefix', () => {
    const version = getSDKVersion();
    expect(version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(version).toBe(`v${SDK_VERSION}`);
  });
});

describe('getSDKInfo', () => {
  it('should return complete version info', () => {
    const info = getSDKInfo();

    expect(info.cliVersion).toBe(CLI_VERSION);
    expect(info.sdkVersion).toBe(SDK_VERSION);
    expect(info.apiVersion).toBe(SDK_API_VERSION);
    expect(info.cliVersionString).toBe(`v${CLI_VERSION}`);
    expect(info.sdkVersionString).toBe(`v${SDK_VERSION}`);
  });

  it('should return consistent data', () => {
    const info1 = getSDKInfo();
    const info2 = getSDKInfo();

    expect(info1).toEqual(info2);
  });
});

describe('getVersionString', () => {
  it('should return formatted version string', () => {
    const str = getVersionString();

    expect(str).toContain('AX CLI');
    expect(str).toContain(CLI_VERSION);
    expect(str).toContain('SDK');
    expect(str).toContain(SDK_VERSION);
    expect(str).toBe(`AX CLI v${CLI_VERSION} (SDK v${SDK_VERSION})`);
  });
});

describe('isSDKVersionCompatible', () => {
  // These tests assume SDK_VERSION is "1.3.0"
  const [currentMajor, currentMinor, currentPatch] = SDK_VERSION.split('.').map(Number);

  describe('valid version strings', () => {
    it('should return true for same version', () => {
      expect(isSDKVersionCompatible(SDK_VERSION)).toBe(true);
    });

    it('should return true for older major version', () => {
      if (currentMajor > 0) {
        expect(isSDKVersionCompatible(`${currentMajor - 1}.0.0`)).toBe(true);
      }
    });

    it('should return true for older minor version', () => {
      if (currentMinor > 0) {
        expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor - 1}.0`)).toBe(true);
      }
    });

    it('should return true for older patch version', () => {
      if (currentPatch > 0) {
        expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor}.${currentPatch - 1}`)).toBe(true);
      }
    });

    it('should return false for newer major version', () => {
      expect(isSDKVersionCompatible(`${currentMajor + 1}.0.0`)).toBe(false);
    });

    it('should return false for newer minor version', () => {
      expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor + 1}.0`)).toBe(false);
    });

    it('should return false for newer patch version', () => {
      expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor}.${currentPatch + 1}`)).toBe(false);
    });

    it('should handle version with v prefix', () => {
      expect(isSDKVersionCompatible(`v${SDK_VERSION}`)).toBe(true);
      expect(isSDKVersionCompatible(`V${SDK_VERSION}`)).toBe(true);
    });

    it('should handle versions with whitespace', () => {
      expect(isSDKVersionCompatible(` ${SDK_VERSION} `)).toBe(true);
    });

    it('should handle partial versions', () => {
      expect(isSDKVersionCompatible(`${currentMajor}`)).toBe(true);
      expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor}`)).toBe(true);
    });

    it('should warn about extra version parts', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      isSDKVersionCompatible('1.0.0.0');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('more than 3 parts'));
      warnSpy.mockRestore();
    });
  });

  describe('invalid version strings', () => {
    it('should throw for empty string', () => {
      expect(() => isSDKVersionCompatible('')).toThrow('Invalid version string');
    });

    it('should throw for whitespace only', () => {
      expect(() => isSDKVersionCompatible('   ')).toThrow('Invalid version string');
    });

    it('should throw for non-numeric version', () => {
      expect(() => isSDKVersionCompatible('abc.def.ghi')).toThrow('Invalid version format');
    });

    it('should throw for negative numbers', () => {
      expect(() => isSDKVersionCompatible('-1.0.0')).toThrow('cannot be negative');
    });

    it('should throw for mixed invalid parts', () => {
      expect(() => isSDKVersionCompatible('1.a.0')).toThrow('Invalid version format');
    });
  });

  describe('edge cases', () => {
    it('should handle version 0.0.0', () => {
      expect(isSDKVersionCompatible('0.0.0')).toBe(true);
    });

    it('should compare major version first', () => {
      // If current is 1.3.0, then 0.99.99 should pass but 2.0.0 should fail
      expect(isSDKVersionCompatible('0.99.99')).toBe(true);
      expect(isSDKVersionCompatible('2.0.0')).toBe(false);
    });

    it('should compare minor version when major matches', () => {
      // Current is 1.3.0
      expect(isSDKVersionCompatible(`${currentMajor}.0.99`)).toBe(true);
      expect(isSDKVersionCompatible(`${currentMajor}.${currentMinor + 1}.0`)).toBe(false);
    });
  });
});
