import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  auditConfig,
  validateConfig,
  readConfig,
  writeConfig,
  migrateConfig,
  looksLikeApiKey,
  looksLikePlaintextKey,
} from '../src/lib/config-parser.js';

const tmpDir = path.join(os.tmpdir(), 'mcpguard-tests');

describe('Config Parser', () => {
  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('looksLikeApiKey', () => {
    it('should detect common API key patterns', () => {
      expect(looksLikeApiKey('api_key')).toBe(true);
      expect(looksLikeApiKey('API_KEY')).toBe(true);
      expect(looksLikeApiKey('apiKey')).toBe(true);
      expect(looksLikeApiKey('token')).toBe(true);
      expect(looksLikeApiKey('access_token')).toBe(true);
      expect(looksLikeApiKey('secret')).toBe(true);
      expect(looksLikeApiKey('password')).toBe(true);
    });

    it('should reject non-key names', () => {
      expect(looksLikeApiKey('command')).toBe(false);
      expect(looksLikeApiKey('args')).toBe(false);
      expect(looksLikeApiKey('url')).toBe(false);
      expect(looksLikeApiKey('name')).toBe(false);
    });
  });

  describe('looksLikePlaintextKey', () => {
    it('should detect long alphanumeric strings', () => {
      expect(looksLikePlaintextKey('abcdefghij1234567890abcdefghij12')).toBe(true);
    });

    it('should detect GitHub PAT', () => {
      expect(looksLikePlaintextKey('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe(true);
    });

    it('should detect OpenAI-style keys', () => {
      expect(looksLikePlaintextKey('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    });

    it('should reject vault references', () => {
      expect(looksLikePlaintextKey('mcpguard://test-id')).toBe(false);
    });

    it('should reject short values', () => {
      expect(looksLikePlaintextKey('short')).toBe(false);
    });

    it('should reject URLs', () => {
      expect(looksLikePlaintextKey('https://api.github.com')).toBe(false);
    });

    it('should reject file paths', () => {
      expect(looksLikePlaintextKey('/usr/local/bin/node')).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid JSON config', () => {
      const configPath = path.join(tmpDir, 'valid.json');
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));

      const result = validateConfig(configPath);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid JSON', () => {
      const configPath = path.join(tmpDir, 'invalid.json');
      fs.writeFileSync(configPath, '{ invalid json }');

      const result = validateConfig(configPath);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should reject non-existent file', () => {
      const result = validateConfig('/non/existent/path.json');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File does not exist');
    });
  });

  describe('readConfig', () => {
    it('should read and parse config file', () => {
      const configPath = path.join(tmpDir, 'config.json');
      const config = {
        mcpServers: {
          github: {
            command: 'mcp-server-github',
            env: { GITHUB_TOKEN: 'test-token' },
          },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = readConfig(configPath);

      expect(result.mcpServers.github.command).toBe('mcp-server-github');
      expect(result.mcpServers.github.env?.GITHUB_TOKEN).toBe('test-token');
    });
  });

  describe('writeConfig', () => {
    it('should write config file with proper formatting', () => {
      const configPath = path.join(tmpDir, 'output.json');
      const config = {
        mcpServers: {
          test: { command: 'test-server' },
        },
      };

      writeConfig(configPath, config);

      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.mcpServers.test.command).toBe('test-server');
    });

    it('should create directory if it does not exist', () => {
      const nestedPath = path.join(tmpDir, 'nested', 'dir', 'config.json');
      const config = { mcpServers: {} };

      writeConfig(nestedPath, config);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('auditConfig', () => {
    it('should detect plaintext credentials', () => {
      const configPath = path.join(tmpDir, 'audit-test.json');
      const config = {
        mcpServers: {
          github: {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
            },
          },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = auditConfig(configPath, 'Test Config');

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.plaintextCount).toBeGreaterThan(0);
      expect(result.findings[0].serverName).toBe('github');
      expect(result.findings[0].riskLevel).toBe('critical');
    });

    it('should recognize vault references as secure', () => {
      const configPath = path.join(tmpDir, 'secure-test.json');
      const config = {
        mcpServers: {
          github: {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: 'mcpguard://test-id-123',
            },
          },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = auditConfig(configPath, 'Test Config');

      expect(result.secureCount).toBeGreaterThan(0);
      expect(result.findings[0].isVaultReference).toBe(true);
    });

    it('should handle nested credentials', () => {
      const configPath = path.join(tmpDir, 'nested-test.json');
      const config = {
        mcpServers: {
          custom: {
            command: 'mcp-server-custom',
            config: {
              auth: {
                apiKey: 'secret-key-12345678901234567890',
              },
            },
          },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(config));

      const result = auditConfig(configPath, 'Test Config');

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].keyName).toBe('apiKey');
    });
  });

  describe('migrateConfig', () => {
    it('should replace plaintext values with vault references', () => {
      const config = {
        mcpServers: {
          github: {
            command: 'mcp-server-github',
            env: {
              GITHUB_TOKEN: 'ghp_test',
              OTHER_VALUE: 'not-a-secret',
            },
          },
        },
      };

      const migrations = [
        {
          serverName: 'github',
          keyPath: ['mcpServers', 'github', 'env', 'GITHUB_TOKEN'],
          vaultReference: 'mcpguard://test-id',
        },
      ];

      const result = migrateConfig(config, migrations);

      expect(result.mcpServers.github.env.GITHUB_TOKEN).toBe('mcpguard://test-id');
      expect(result.mcpServers.github.env.OTHER_VALUE).toBe('not-a-secret');
    });

    it('should handle multiple migrations', () => {
      const config = {
        mcpServers: {
          github: {
            env: { TOKEN: 'ghp_test' },
          },
          linear: {
            env: { API_KEY: 'lin_test' },
          },
        },
      };

      const migrations = [
        {
          serverName: 'github',
          keyPath: ['mcpServers', 'github', 'env', 'TOKEN'],
          vaultReference: 'mcpguard://id-1',
        },
        {
          serverName: 'linear',
          keyPath: ['mcpServers', 'linear', 'env', 'API_KEY'],
          vaultReference: 'mcpguard://id-2',
        },
      ];

      const result = migrateConfig(config, migrations);

      expect(result.mcpServers.github.env.TOKEN).toBe('mcpguard://id-1');
      expect(result.mcpServers.linear.env.API_KEY).toBe('mcpguard://id-2');
    });
  });
});
