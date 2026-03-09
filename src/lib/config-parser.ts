import * as fs from 'fs';
import * as path from 'path';
import { Vault } from './vault.js';

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  [key: string]: unknown;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

export interface CredentialFinding {
  serverName: string;
  keyName: string;
  value: string;
  isVaultReference: boolean;
  path: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface AuditResult {
  configPath: string;
  configName: string;
  findings: CredentialFinding[];
  secureCount: number;
  plaintextCount: number;
}

/**
 * Common environment variable names that indicate API keys
 */
const API_KEY_PATTERNS = [
  /api[_-]?key/i,
  /apikey/i,
  /token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /auth/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /bearer/i,
];

/**
 * Check if a key name looks like an API key
 */
export function looksLikeApiKey(keyName: string): boolean {
  return API_KEY_PATTERNS.some((pattern) => pattern.test(keyName));
}

/**
 * Check if a value looks like a plaintext API key
 */
export function looksLikePlaintextKey(value: string): boolean {
  // Skip if it's a vault reference
  if (Vault.isReference(value)) {
    return false;
  }

  // Skip empty values
  if (!value || value.length < 8) {
    return false;
  }

  // Skip if it looks like a path or URL (handled separately)
  if (value.startsWith('/') || value.startsWith('http')) {
    return false;
  }

  // Check for common API key patterns
  const apiKeyPatterns = [
    /^[a-zA-Z0-9]{32,}$/, // Long alphanumeric strings
    /^sk-[a-zA-Z0-9]{20,}/, // OpenAI-style keys
    /^ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
    /^glpat-[a-zA-Z0-9-]{20,}/, // GitLab PAT
    /^xox[baprs]-[a-zA-Z0-9-]{20,}/, // Slack tokens
    /^eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/, // JWT
  ];

  return apiKeyPatterns.some((pattern) => pattern.test(value));
}

/**
 * Recursively find credentials in a config object
 */
function findCredentialsInObject(
  obj: unknown,
  serverName: string,
  currentPath: string[] = []
): CredentialFinding[] {
  const findings: CredentialFinding[] = [];

  if (!obj || typeof obj !== 'object') {
    return findings;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      findings.push(...findCredentialsInObject(obj[i], serverName, [...currentPath, String(i)]));
    }
    return findings;
  }

  const record = obj as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
    const newPath = [...currentPath, key];

    if (typeof value === 'string') {
      const isVaultReference = Vault.isReference(value);
      const isPlaintext = looksLikePlaintextKey(value);
      const isApiKey = looksLikeApiKey(key);

      // Determine risk level
      let riskLevel: CredentialFinding['riskLevel'] = 'low';
      
      if (isApiKey && isPlaintext) {
        riskLevel = 'critical';
      } else if (isPlaintext) {
        riskLevel = 'high';
      } else if (isApiKey && !isVaultReference) {
        riskLevel = 'medium';
      }

      if (isApiKey || isPlaintext) {
        findings.push({
          serverName,
          keyName: key,
          value,
          isVaultReference,
          path: newPath,
          riskLevel,
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      findings.push(...findCredentialsInObject(value, serverName, newPath));
    }
  }

  return findings;
}

/**
 * Parse and audit an MCP config file
 */
export function auditConfig(configPath: string, configName: string): AuditResult {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content) as MCPConfig;

  const allFindings: CredentialFinding[] = [];
  let secureCount = 0;
  let plaintextCount = 0;

  if (config.mcpServers && typeof config.mcpServers === 'object') {
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      const findings = findCredentialsInObject(serverConfig, serverName);
      
      for (const finding of findings) {
        if (finding.isVaultReference) {
          secureCount++;
        } else if (finding.riskLevel === 'critical' || finding.riskLevel === 'high') {
          plaintextCount++;
        }
      }

      allFindings.push(...findings);
    }
  }

  return {
    configPath,
    configName,
    findings: allFindings,
    secureCount,
    plaintextCount,
  };
}

/**
 * Check if a config file exists and is valid JSON
 */
export function validateConfig(configPath: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(configPath)) {
    return { valid: false, error: 'File does not exist' };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    JSON.parse(content);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
}

/**
 * Read an MCP config file
 */
export function readConfig(configPath: string): MCPConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as MCPConfig;
}

/**
 * Write an MCP config file
 */
export function writeConfig(configPath: string, config: MCPConfig): void {
  // Ensure directory exists
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Replace plaintext values with vault references in a config
 */
export function migrateConfig(
  config: MCPConfig,
  migrations: Array<{ serverName: string; keyPath: string[]; vaultReference: string }>
): MCPConfig {
  const newConfig = JSON.parse(JSON.stringify(config)) as MCPConfig;

  for (const migration of migrations) {
    let current: unknown = newConfig;
    
    // Navigate to parent of the key to update
    for (let i = 0; i < migration.keyPath.length - 1; i++) {
      const key = migration.keyPath[i];
      if (typeof current === 'object' && current !== null && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        break;
      }
    }

    // Update the value
    if (typeof current === 'object' && current !== null) {
      const lastKey = migration.keyPath[migration.keyPath.length - 1];
      (current as Record<string, unknown>)[lastKey] = migration.vaultReference;
    }
  }

  return newConfig;
}
