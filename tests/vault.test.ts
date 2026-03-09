import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Vault } from '../src/lib/vault.js';

// Mock keytar
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

import keytar from 'keytar';

describe('Vault', () => {
  let vault: Vault;
  const mockService = 'mcpguard-test';

  beforeEach(() => {
    vi.clearAllMocks();
    vault = new Vault(mockService);
  });

  describe('generateReference', () => {
    it('should generate a valid vault reference', () => {
      const id = 'test-id-123';
      const reference = Vault.generateReference(id);
      expect(reference).toBe('mcpguard://test-id-123');
    });
  });

  describe('isReference', () => {
    it('should return true for valid references', () => {
      expect(Vault.isReference('mcpguard://test-id')).toBe(true);
    });

    it('should return false for non-references', () => {
      expect(Vault.isReference('plain-text-key')).toBe(false);
      expect(Vault.isReference('')).toBe(false);
      expect(Vault.isReference('mcpguard:')).toBe(false);
    });
  });

  describe('extractId', () => {
    it('should extract ID from valid reference', () => {
      const id = Vault.extractId('mcpguard://test-123');
      expect(id).toBe('test-123');
    });

    it('should return null for invalid reference', () => {
      expect(Vault.extractId('not-a-reference')).toBe(null);
    });
  });

  describe('set', () => {
    it('should store credential in keychain', async () => {
      const mockStored = JSON.stringify({
        credential: {
          id: 'test-id',
          service: 'github',
          keyType: 'API_KEY',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        value: 'test-secret-value',
      });

      vi.mocked(keytar.setPassword).mockResolvedValue();
      vi.mocked(keytar.getPassword).mockResolvedValue(mockStored);

      const credential = await vault.set('github', 'API_KEY', 'test-secret');

      expect(credential.id).toBeDefined();
      expect(credential.service).toBe('github');
      expect(credential.keyType).toBe('API_KEY');
      expect(keytar.setPassword).toHaveBeenCalledWith(
        mockService,
        credential.id,
        expect.any(String)
      );
    });
  });

  describe('get', () => {
    it('should retrieve credential from keychain', async () => {
      const mockData = {
        credential: {
          id: 'test-id',
          service: 'github',
          keyType: 'API_KEY',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        value: 'test-secret-value',
      };

      vi.mocked(keytar.getPassword).mockResolvedValue(JSON.stringify(mockData));

      const result = await vault.get('test-id');

      expect(result).not.toBeNull();
      expect(result?.credential.id).toBe('test-id');
      expect(result?.value).toBe('test-secret-value');
    });

    it('should return null for non-existent credential', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);

      const result = await vault.get('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete credential from keychain', async () => {
      vi.mocked(keytar.deletePassword).mockResolvedValue(true);

      const result = await vault.delete('test-id');

      expect(result).toBe(true);
      expect(keytar.deletePassword).toHaveBeenCalledWith(mockService, 'test-id');
    });
  });

  describe('list', () => {
    it('should list all credentials from manifest', async () => {
      const manifest = JSON.stringify(['id-1', 'id-2']);
      const credential1 = JSON.stringify({
        credential: {
          id: 'id-1',
          service: 'github',
          keyType: 'API_KEY',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        value: 'secret-1',
      });

      vi.mocked(keytar.getPassword)
        .mockResolvedValueOnce(manifest)
        .mockResolvedValueOnce(credential1)
        .mockResolvedValue(null);

      const credentials = await vault.list();

      expect(credentials.length).toBe(1);
      expect(credentials[0].service).toBe('github');
    });

    it('should return empty array when no manifest', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);

      const credentials = await vault.list();

      expect(credentials).toEqual([]);
    });
  });

  describe('isAccessible', () => {
    it('should return true when keychain is accessible', async () => {
      vi.mocked(keytar.setPassword).mockResolvedValue();
      vi.mocked(keytar.getPassword).mockResolvedValue('test');
      vi.mocked(keytar.deletePassword).mockResolvedValue(true);

      const result = await vault.isAccessible();

      expect(result).toBe(true);
    });

    it('should return false when keychain is not accessible', async () => {
      vi.mocked(keytar.setPassword).mockRejectedValue(new Error('Keychain locked'));

      const result = await vault.isAccessible();

      expect(result).toBe(false);
    });
  });
});
