import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { getConfigPaths } from '../utils/config-paths.js';
import { auditConfig } from '../lib/config-parser.js';

export function createAuditCommand(): Command {
  const audit = new Command('audit');

  audit
    .description('Scan MCP config files for plaintext credentials')
    .option('-p, --path <path>', 'Specific config file path to audit')
    .option('-j, --json', 'Output results as JSON')
    .action(async (options) => {
      const spinner = ora('Scanning for plaintext credentials...').start();

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
            if (result.findings.length > 0 || result.secureCount > 0) {
              results.push(result);
            }
          } catch (err) {
            // Skip invalid JSON files
          }
        }

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        // Calculate totals
        let totalPlaintext = 0;
        let totalSecure = 0;
        let totalServers = 0;

        for (const result of results) {
          totalPlaintext += result.plaintextCount;
          totalSecure += result.secureCount;
          const serverNames = new Set(result.findings.map((f) => f.serverName));
          totalServers += serverNames.size;
        }

        // Display results
        console.log('');

        if (results.length === 0) {
          console.log(chalk.gray('No MCP config files found.'));
          console.log('');
          console.log('Supported config locations:');
          for (const cp of configPaths) {
            console.log(chalk.dim(`  - ${cp.path}`));
          }
          return;
        }

        // Scary summary
        const serversWithIssues = new Set<string>();
        const criticalFindings = [];

        for (const result of results) {
          for (const finding of result.findings) {
            if (!finding.isVaultReference && (finding.riskLevel === 'critical' || finding.riskLevel === 'high')) {
              serversWithIssues.add(finding.serverName);
              criticalFindings.push(finding);
            }
          }
        }

        const totalMcpServers = totalServers || 1;
        const serversWithIssuesCount = serversWithIssues.size || totalPlaintext;

        if (totalPlaintext > 0) {
          console.log(chalk.bold.red('⚠️  SECURITY ALERT'));
          console.log('');
          console.log(
            chalk.red(
              `${serversWithIssuesCount} of your ${totalMcpServers} MCP server${totalMcpServers > 1 ? 's' : ''} ${serversWithIssuesCount > 1 ? 'have' : 'has'} plaintext API keys`
            )
          );
          console.log('');

          // Show findings by config
          for (const result of results) {
            const plaintextFindings = result.findings.filter(
              (f) => !f.isVaultReference && (f.riskLevel === 'critical' || f.riskLevel === 'high')
            );

            if (plaintextFindings.length > 0) {
              console.log(chalk.yellow(`📁 ${result.configName}: ${result.configPath}`));
              console.log('');

              for (const finding of plaintextFindings) {
                const icon = finding.riskLevel === 'critical' ? '🔴' : '🟠';
                console.log(`  ${icon} ${chalk.bold(finding.serverName)}.${finding.keyName}`);
                console.log(`     Risk: ${chalk.red(finding.riskLevel.toUpperCase())}`);
                console.log(`     Value: ${chalk.dim( obfuscate(finding.value))}`);
                console.log('');
              }
            }
          }

          // Recommendations
          console.log(chalk.bold('📋 Recommended Actions:'));
          console.log('');
          console.log(`  1. Run ${chalk.cyan('mcpguard migrate')} to move all keys to secure vault`);
          console.log(`  2. Rotate exposed API keys immediately`);
          console.log(`  3. Check git history for accidentally committed secrets`);
          console.log('');

          // Exit with error code for CI/CD
          process.exitCode = 1;
        } else if (totalSecure > 0) {
          console.log(chalk.bold.green('✅ All MCP credentials are secure'));
          console.log('');
          console.log(chalk.green(`${totalSecure} credential${totalSecure > 1 ? 's' : ''} stored in vault`));
          console.log('');
        } else {
          console.log(chalk.gray('No MCP credentials found in config files.'));
          console.log('');
        }
      } catch (err) {
        spinner.fail('Audit failed');
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  return audit;
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
