# 🔒 mcpguard

> **The 1Password for AI Agents** — Secure MCP credential manager

[![npm version](https://img.shields.io/npm/v/mcpguard.svg)](https://www.npmjs.com/package/mcpguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/mcpguard)](https://www.npmjs.com/package/mcpguard)

**mcpguard** replaces plaintext API keys in your MCP config files with encrypted vault references. Credentials are stored securely in your OS keychain — never written to disk in plaintext.

## ⚠️ The Problem

53% of MCP servers use **plaintext API keys** stored in config files. These keys get:
- Committed to git repositories
- Shared across machines
- Exposed in data breaches

8,000+ MCP servers were found publicly accessible on the internet in February 2026.

## ✅ The Solution

mcpguard is a local-first CLI tool that:
- Scans your MCP configs for plaintext credentials
- Migrates them to an encrypted vault (OS keychain)
- Replaces values with secure references
- Injects credentials at runtime — never on disk

## 🚀 Quick Start

```bash
# Install
npm install -g mcpguard

# Audit your current setup
mcpguard audit

# Migrate all plaintext keys to vault
mcpguard migrate

# Done! Your credentials are now secure
```

## 📋 Commands

### `mcpguard audit`

Scan MCP config files for plaintext credentials.

```bash
mcpguard audit
mcpguard audit --json
mcpguard audit --path ~/.config/claude/claude_desktop_config.json
```

**Example output:**

```
⚠️  SECURITY ALERT

3 of your 4 MCP servers have plaintext API keys

📁 Claude Desktop: ~/.config/claude/claude_desktop_config.json

  🔴 github.API_KEY
     Risk: CRITICAL
     Value: ghp_...x7k9

  🟠 linear.TOKEN
     Risk: HIGH
     Value: lin_...a2b4

📋 Recommended Actions:

  1. Run mcpguard migrate to move all keys to secure vault
  2. Rotate exposed API keys immediately
  3. Check git history for accidentally committed secrets
```

### `mcpguard migrate`

Move all plaintext credentials to the secure vault.

```bash
mcpguard migrate
mcpguard migrate --yes  # Skip confirmation
```

**What happens:**
1. Scans all MCP config files
2. Identifies plaintext credentials
3. Stores each in OS keychain (encrypted)
4. Replaces values with `mcpguard://` references
5. Your config files no longer contain secrets

### `mcpguard add <service>`

Add a credential manually.

```bash
mcpguard add github
mcpguard add linear --key API_TOKEN
mcpguard add notion --value ntn_1234567890abcdef
```

### `mcpguard list`

List all stored credentials.

```bash
mcpguard list
mcpguard list --json
```

### `mcpguard status`

Show vault health and statistics.

```bash
mcpguard status
```

## 🔧 Supported Config Files

mcpguard automatically scans these locations:

| Config | Path |
|--------|------|
| Claude Desktop | `~/.config/claude/claude_desktop_config.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Generic | `~/.mcp.json`, `./.mcp.json`, `./mcp.json` |

## 🛡️ Security Model

- **OS Keychain**: Credentials stored in macOS Keychain, Linux Secret Service, or Windows Credential Manager
- **AES-256**: Fallback encryption for credentials not in keychain
- **Zero Plaintext**: No secrets written to disk
- **Local-First**: No cloud sync, no network calls
- **Open Source**: Security through transparency

## 📦 Installation

### npm

```bash
npm install -g mcpguard
```

### Homebrew (macOS/Linux)

```bash
brew install mcpguard
```

### From Source

```bash
git clone https://github.com/JulienPoitou/mcpguard
cd mcpguard
npm install
npm run build
npm link
```

## 🧪 Example Workflow

### Before mcpguard

Your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    },
    "linear": {
      "command": "mcp-server-linear",
      "env": {
        "LINEAR_API_KEY": "lin_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

⚠️ **Problem**: API keys are in plaintext, exposed to anyone with file access.

### After mcpguard migrate

```bash
mcpguard migrate
```

Your config becomes:

```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "env": {
        "GITHUB_TOKEN": "mcpguard://a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      }
    },
    "linear": {
      "command": "mcp-server-linear",
      "env": {
        "LINEAR_API_KEY": "mcpguard://b2c3d4e5-f6a7-8901-bcde-f12345678901"
      }
    }
  }
}
```

✅ **Secure**: Credentials stored encrypted in OS keychain, injected at runtime.

## 🧩 Runtime Integration

mcpguard provides a runtime shim for MCP clients:

```bash
# Run your MCP client through mcpguard
mcpguard run claude
```

Or use the Node.js API:

```typescript
import { McpGuardRuntime } from 'mcpguard/runtime';

const runtime = new McpGuardRuntime();
const config = await runtime.injectCredentials(originalConfig);
```

## 📊 Comparison

| Feature | mcpguard | Plaintext | 1Password |
|---------|----------|-----------|-----------|
| MCP-native | ✅ | ❌ | ❌ |
| OS Keychain | ✅ | ❌ | ✅ |
| Auto-migrate | ✅ | N/A | ❌ |
| Local-first | ✅ | ✅ | ❌ |
| Free | ✅ | ✅ | ❌ |
| OAuth flows | ✅ (v0.2) | ❌ | ❌ |

## 🗺️ Roadmap

- **v0.1** (Current): Vault + audit + migrate + basic CLI
- **v0.2**: OAuth flows for GitHub, Google, Linear, Notion; rotation alerts; audit log
- **v0.3**: mcpscan integration; permission scoping; provider registry
- **v1.0**: Team vaults; CI/CD integration; VSCode extension

## 🧠 Why "mcpguard"?

The Model Context Protocol (MCP) has become the universal interface between AI agents and tools. Adopted by Anthropic, OpenAI, Google, and backed by the Linux Foundation, MCP now powers integrations for GitHub, Linear, Figma, Supabase, Notion, and hundreds more.

mcpguard ensures this ecosystem doesn't repeat the mistakes of the past — plaintext credentials are not a viable security model.

## 📄 License

MIT — See [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/mcpguard
cd mcpguard

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## 📬 Issues

Report bugs and feature requests at [github.com/JulienPoitou/mcpguard/issues](https://github.com/JulienPoitou/mcpguard/issues).

---

**Built with ❤️ by [Julien Poitou](https://github.com/JulienPoitou)**
