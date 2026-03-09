import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { Vault } from '../lib/vault.js';

export function createAddCommand(): Command {
  const add = new Command('add');

  add
    .description('Add a new credential to the vault')
    .argument('<service>', 'Service name (e.g., github, linear, notion)')
    .option('-k, --key <name>', 'Key name (e.g., API_KEY, TOKEN)', 'API_KEY')
    .option('-v, --value <value>', 'Credential value (skips prompt if provided)')
    .action(async (service, options) => {
      try {
        let { value } = options;

        if (!value) {
          // Prompt for credential value securely
          const answers = await inquirer.prompt([
            {
              type: 'password',
              name: 'value',
              message: `Enter ${service} ${options.key}:`,
              mask: '*',
            },
          ]);

          value = answers.value;
        }

        if (!value || value.trim().length === 0) {
          console.log(chalk.red('Error: Credential value cannot be empty'));
          process.exit(1);
        }

        const spinner = ora('Storing credential in vault...').start();

        const vault = new Vault();

        // Check vault accessibility
        const isAccessible = await vault.isAccessible();
        if (!isAccessible) {
          spinner.fail('Cannot access OS keychain');
          console.log(
            chalk.red(
              'Error: Unable to access your OS keychain. Please ensure your system keychain is unlocked.'
            )
          );
          process.exit(1);
        }

        const credential = await vault.store(service, options.key, value);

        spinner.succeed('Credential stored!');
        console.log('');
        console.log(chalk.green(`✅ Added ${chalk.cyan(service)}.${chalk.cyan(options.key)}`));
        console.log('');
        console.log(chalk.dim(`  ID: ${credential.id}`));
        console.log(chalk.dim(`  Created: ${credential.createdAt}`));
        console.log('');
        console.log(
          chalk.dim('  Use ') +
            chalk.cyan('mcpguard list') +
            chalk.dim(' to see all stored credentials.')
        );
        console.log('');
      } catch (err) {
        console.error(chalk.red('Error: ') + (err as Error).message);
        process.exit(1);
      }
    });

  return add;
}

export function createListCommand(): Command {
  const list = new Command('list');

  list
    .description('List all credentials stored in the vault')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Loading credentials...').start();

      try {
        const vault = new Vault();
        const credentials = await vault.list();

        spinner.stop();

        if (credentials.length === 0) {
          console.log(chalk.gray('No credentials stored in vault.'));
          console.log('');
          console.log(
            chalk.dim('Use ') +
              chalk.cyan('mcpguard add <service>') +
              chalk.dim(' to add a credential.')
          );
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(credentials, null, 2));
          return;
        }

        console.log('');
        console.log(chalk.bold('Stored Credentials:'));
        console.log('');
        console.log(chalk.dim(`  ${credentials.length} credential${credentials.length > 1 ? 's' : ''} in vault`));
        console.log('');

        // Group by service
        const byService = new Map<string, typeof credentials>();
        for (const cred of credentials) {
          const existing = byService.get(cred.service) || [];
          existing.push(cred);
          byService.set(cred.service, existing);
        }

        for (const [service, creds] of byService) {
          console.log(chalk.cyan(`  ${service}:`));
          
          for (const cred of creds) {
            console.log(
              chalk.dim(`    - ${cred.keyType}`) +
                chalk.dim(` (added ${formatDate(cred.createdAt)})`)
            );
          }
          console.log('');
        }
      } catch (err) {
        spinner.fail('Failed to load credentials');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  return list;
}

export function createStatusCommand(): Command {
  const status = new Command('status');

  status
    .description('Show vault health and statistics')
    .action(async () => {
      const spinner = ora('Checking vault status...').start();

      try {
        const vault = new Vault();

        // Check vault accessibility
        const isAccessible = await vault.isAccessible();
        const credentials = await vault.list();

        spinner.stop();

        console.log('');
        console.log(chalk.bold('Mcpguard Vault Status'));
        console.log('');

        // Vault status
        const statusIcon = isAccessible ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${statusIcon} Vault Access: ${isAccessible ? chalk.green('OK') : chalk.red('FAILED')}`);
        console.log(`  ${chalk.green('✓')} Credentials Stored: ${credentials.length}`);
        console.log('');

        // Service breakdown
        if (credentials.length > 0) {
          const services = new Set(credentials.map((c) => c.service));
          console.log(chalk.dim(`  ${services.size} service${services.size > 1 ? 's' : ''} configured`));
          console.log('');

          // Recent activity
          const sorted = [...credentials].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          const recent = sorted[0];
          console.log(chalk.dim(`  Last activity: ${formatDate(recent.updatedAt)}`));
        } else {
          console.log(chalk.dim('  No credentials stored yet.'));
          console.log('');
          console.log(
            chalk.dim('  Run ') +
              chalk.cyan('mcpguard add <service>') +
              chalk.dim(' to add your first credential.')
          );
        }

        console.log('');

        // Security info
        console.log(chalk.bold('Security:'));
        console.log('');
        console.log(chalk.dim('  • Credentials encrypted with OS keychain'));
        console.log(chalk.dim('  • No plaintext secrets on disk'));
        console.log(chalk.dim('  • Local-first, no cloud sync'));
        console.log('');
      } catch (err) {
        spinner.fail('Status check failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  return status;
}

/**
 * Format a date string for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}
