import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Vault } from '../lib/vault.js';
import { getConfigPaths } from '../utils/config-paths.js';
import {
  auditConfig,
  readConfig,
  writeConfig,
  migrateConfig,
  CredentialFinding,
} from '../lib/config-parser.js';

export function createMigrateCommand(): Command {
  const migrate = new Command('migrate');

  migrate
    .description('Move all plaintext credentials to secure vault')
    .option('-p, --path <path>', 'Specific config file path to migrate')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options) => {
      const spinner = ora('Analyzing credentials...').start();

      try {
        const configPaths = options.path
          ? [{ name: 'Custom', path: options.path, type: 'generic' as const }]
          : getConfigPaths();

        const results = [];

        for (const configPath of configPaths) {
          if (!fs.existsSync(configPath.path)) {
            continue;
          }

          try {
            const result = auditConfig(configPath.path, configPath.name);
            if (result.findings.length > 0) {
              results.push(result);
            }
          } catch {
            // Skip invalid files
          }
        }

        if (results.length === 0) {
          spinner.stop();
          console.log(chalk.gray('No MCP config files with credentials found.'));
          return;
        }

        // Collect all plaintext credentials to migrate
        const toMigrate: Array<{
          configPath: string;
          finding: CredentialFinding;
        }> = [];

        for (const result of results) {
          for (const finding of result.findings) {
            if (
              !finding.isVaultReference &&
              (finding.riskLevel === 'critical' || finding.riskLevel === 'high')
            ) {
              toMigrate.push({
                configPath: result.configPath,
                finding,
              });
            }
          }
        }

        if (toMigrate.length === 0) {
          spinner.stop();
          console.log(chalk.green('✅ All credentials are already secure!'));
          return;
        }

        spinner.stop();

        // Show what will be migrated
        console.log('');
        console.log(chalk.bold('Credentials to migrate:'));
        console.log('');

        for (const { finding } of toMigrate) {
          console.log(
            `  ${chalk.cyan(finding.serverName)}.${finding.keyName} - ${chalk.dim(obfuscate(finding.value))}`
          );
        }

        console.log('');

        // Confirm migration
        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Migrate ${toMigrate.length} credential${toMigrate.length > 1 ? 's' : ''} to secure vault?`,
              default: true,
            },
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Migration cancelled.'));
            return;
          }
        }

        // Perform migration
        const migrateSpinner = ora('Migrating credentials to vault...').start();
        const vault = new Vault();

        // Check vault accessibility
        const isAccessible = await vault.isAccessible();
        if (!isAccessible) {
          migrateSpinner.fail('Cannot access OS keychain');
          console.log(
            chalk.red(
              'Error: Unable to access your OS keychain. Please ensure your system keychain is unlocked.'
            )
          );
          process.exit(1);
        }

        const migrations: Array<{
          configPath: string;
          serverName: string;
          keyPath: string[];
          vaultReference: string;
        }> = [];

        for (const { configPath, finding } of toMigrate) {
          try {
            // Store in vault
            const credential = await vault.store(
              finding.serverName,
              finding.keyName,
              finding.value
            );

            const vaultReference = Vault.generateReference(credential.id);

            migrations.push({
              configPath,
              serverName: finding.serverName,
              keyPath: finding.path,
              vaultReference,
            });
          } catch (err) {
            migrateSpinner.fail(`Failed to store ${finding.serverName}.${finding.keyName}`);
            console.error(chalk.red((err as Error).message));
            process.exit(1);
          }
        }

        // Update config files
        const configUpdates = new Map<string, typeof migrations>();
        for (const migration of migrations) {
          const existing = configUpdates.get(migration.configPath) || [];
          existing.push(migration);
          configUpdates.set(migration.configPath, existing);
        }

        for (const [configPath, configMigrations] of configUpdates) {
          const config = readConfig(configPath);
          const migratedConfig = migrateConfig(config, configMigrations);
          writeConfig(configPath, migratedConfig);
        }

        migrateSpinner.succeed('Migration complete!');
        console.log('');
        console.log(chalk.green(`✅ Successfully migrated ${toMigrate.length} credential${toMigrate.length > 1 ? 's' : ''}`));
        console.log('');
        console.log(chalk.bold('What changed:'));
        console.log('');

        for (const migration of migrations) {
          console.log(
            `  ✓ ${chalk.cyan(migration.serverName)} - Credential stored in OS keychain`
          );
        }

        console.log('');
        console.log(chalk.bold('⚠️  Important:'));
        console.log('');
        console.log(
          '  Your config files now reference the vault. The actual credentials'
        );
        console.log('  are stored encrypted in your OS keychain and never written to disk.');
        console.log('');
        console.log(
          chalk.dim('  Run ') +
            chalk.cyan('mcpguard list') +
            chalk.dim(' to see all stored credentials.')
        );
        console.log('');
      } catch (err) {
        spinner.fail('Migration failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  return migrate;
}

/**
 * Obfuscate a secret value for display
 */
function obfuscate(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return value.slice(0, 4) + '...' + value.slice(-4);
}
