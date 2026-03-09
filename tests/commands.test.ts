import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditCommand } from '../src/commands/audit.js';
import { createMigrateCommand } from '../src/commands/migrate.js';
import { createAddCommand, createListCommand, createStatusCommand } from '../src/commands/vault.js';

// Mock dependencies
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

describe('CLI Commands', () => {
  describe('createAuditCommand', () => {
    it('should create audit command with correct options', () => {
      const command = createAuditCommand();

      expect(command.name()).toBe('audit');
      expect(command.description()).toContain('Scan');
      
      const options = command.options;
      expect(options.some((o) => o.flags.includes('--path'))).toBe(true);
      expect(options.some((o) => o.flags.includes('--json'))).toBe(true);
    });
  });

  describe('createMigrateCommand', () => {
    it('should create migrate command with correct options', () => {
      const command = createMigrateCommand();

      expect(command.name()).toBe('migrate');
      expect(command.description()).toContain('Move');
      
      const options = command.options;
      expect(options.some((o) => o.flags.includes('--path'))).toBe(true);
      expect(options.some((o) => o.flags.includes('--yes'))).toBe(true);
    });
  });

  describe('createAddCommand', () => {
    it('should create add command with service argument', () => {
      const command = createAddCommand();

      expect(command.name()).toBe('add');
      expect(command.description()).toContain('Add');
      
      const options = command.options;
      expect(options.some((o) => o.flags.includes('--key'))).toBe(true);
      expect(options.some((o) => o.flags.includes('--value'))).toBe(true);
    });
  });

  describe('createListCommand', () => {
    it('should create list command with json option', () => {
      const command = createListCommand();

      expect(command.name()).toBe('list');
      expect(command.description()).toContain('List');
      
      const options = command.options;
      expect(options.some((o) => o.flags.includes('--json'))).toBe(true);
    });
  });

  describe('createStatusCommand', () => {
    it('should create status command', () => {
      const command = createStatusCommand();

      expect(command.name()).toBe('status');
      expect(command.description()).toContain('Show');
    });
  });
});
