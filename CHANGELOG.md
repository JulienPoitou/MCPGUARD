# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of mcpguard
- `audit` command - Scan MCP config files for plaintext credentials
- `migrate` command - Move all plaintext credentials to secure vault
- `add` command - Add a new credential to the vault
- `list` command - List all credentials stored in the vault
- `status` command - Show vault health and statistics
- OS keychain integration via keytar (macOS, Linux, Windows)
- Support for Claude Desktop, Cursor, and generic MCP configs
- 43 unit tests with vitest
- GitHub Actions CI/CD pipeline

### Security
- Credentials stored encrypted in OS keychain
- No plaintext secrets written to disk
- Zero network calls - entirely local-first

## [0.1.0] - 2026-03-09

### Initial Release
- First public release
- Core vault functionality
- CLI with audit, migrate, add, list, status commands
- README and documentation
