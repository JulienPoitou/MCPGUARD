import { describe, it, expect } from 'vitest';
import { getConfigPaths, getPrimaryConfigPath } from '../src/utils/config-paths.js';
import * as os from 'os';

describe('Config Paths', () => {
  const homeDir = os.homedir();

  describe('getConfigPaths', () => {
    it('should return Claude Desktop config paths', () => {
      const paths = getConfigPaths();

      expect(paths.some((p) => p.name.includes('Claude'))).toBe(true);
      expect(paths.some((p) => p.type === 'claude')).toBe(true);
    });

    it('should return Cursor config paths', () => {
      const paths = getConfigPaths();

      expect(paths.some((p) => p.name.includes('Cursor'))).toBe(true);
      expect(paths.some((p) => p.type === 'cursor')).toBe(true);
    });

    it('should include generic .mcp.json paths', () => {
      const paths = getConfigPaths();

      expect(paths.some((p) => p.type === 'generic')).toBe(true);
    });

    it('should include home directory paths', () => {
      const paths = getConfigPaths();

      expect(paths.some((p) => p.path.includes(homeDir))).toBe(true);
    });
  });

  describe('getPrimaryConfigPath', () => {
    it('should return a valid config path object', () => {
      const primary = getPrimaryConfigPath();

      expect(primary).not.toBeNull();
      expect(primary?.name).toBeDefined();
      expect(primary?.path).toBeDefined();
      expect(primary?.type).toBeDefined();
    });
  });
});
