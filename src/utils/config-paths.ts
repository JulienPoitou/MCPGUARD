import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const homeDir = os.homedir();

export interface ConfigPath {
  name: string;
  path: string;
  type: 'claude' | 'cursor' | 'generic';
}

/**
 * Get all possible MCP config file paths to scan
 */
export function getConfigPaths(): ConfigPath[] {
  const paths: ConfigPath[] = [
    // Claude Desktop
    {
      name: 'Claude Desktop',
      path: path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json'),
      type: 'claude',
    },
    {
      name: 'Claude Desktop (macOS)',
      path: path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      type: 'claude',
    },
    // Cursor
    {
      name: 'Cursor',
      path: path.join(homeDir, '.cursor', 'mcp.json'),
      type: 'cursor',
    },
    {
      name: 'Cursor (Windows)',
      path: path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'mcp.json'),
      type: 'cursor',
    },
  ];

  // Check for .mcp.json in common locations
  const genericLocations = [
    path.join(homeDir, '.mcp.json'),
    path.join(process.cwd(), '.mcp.json'),
    path.join(process.cwd(), 'mcp.json'),
  ];

  for (const loc of genericLocations) {
    paths.push({
      name: `Generic (${path.basename(path.dirname(loc))})`,
      path: loc,
      type: 'generic',
    });
  }

  return paths;
}

/**
 * Get the primary config path based on what exists
 */
export function getPrimaryConfigPath(): ConfigPath | null {
  const paths = getConfigPaths();

  for (const configPath of paths) {
    if (fs.existsSync(configPath.path)) {
      return configPath;
    }
  }

  // Return default if none exists
  return {
    name: 'Claude Desktop',
    path: path.join(homeDir, '.config', 'claude', 'claude_desktop_config.json'),
    type: 'claude',
  };
}

/**
 * Get the directory for mcpguard's own config
 */
export function getMcpguardConfigDir(): string {
  return path.join(homeDir, '.config', 'mcpguard');
}

/**
 * Get the path to mcpguard's config file
 */
export function getMcpguardConfigPath(): string {
  return path.join(getMcpguardConfigDir(), 'config.json');
}
