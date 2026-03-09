#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createAuditCommand } from './commands/audit.js';
import { createMigrateCommand } from './commands/migrate.js';
import { createAddCommand, createListCommand, createStatusCommand } from './commands/vault.js';

const pkg = {
  name: 'mcpguard',
  version: '0.1.0',
};

function createCli(): Command {
  const program = new Command();

  program
    .name(pkg.name)
    .description('The 1Password for AI Agents - Secure MCP credential manager')
    .version(pkg.version);

  // Add all commands
  program.addCommand(createAuditCommand());
  program.addCommand(createMigrateCommand());
  program.addCommand(createAddCommand());
  program.addCommand(createListCommand());
  program.addCommand(createStatusCommand());

  // Custom help
  program.addHelpText('after', `
${chalk.bold('Examples:')}

  ${chalk.cyan('mcpguard audit')}              Scan for plaintext credentials
  ${chalk.cyan('mcpguard migrate')}            Move all keys to secure vault
  ${chalk.cyan('mcpguard add github')}         Add a GitHub credential
  ${chalk.cyan('mcpguard list')}               List all stored credentials
  ${chalk.cyan('mcpguard status')}             Show vault health

${chalk.bold('Security:')}

  All credentials are stored encrypted in your OS keychain.
  No plaintext secrets are ever written to disk.

${chalk.dim('Report issues: https://github.com/JulienPoitou/mcpguard/issues')}
`);

  return program;
}

// Parse arguments
const program = createCli();
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
