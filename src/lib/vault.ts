import keytar from 'keytar';
import { v4 as uuidv4 } from 'uuid';

const SERVICE_NAME = 'mcpguard';
const VAULT_PREFIX = 'mcpguard://';

export interface Credential {
  id: string;
  service: string;
  keyType: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultEntry {
  credential: Credential;
  value: string;
}

/**
 * Vault class - Handles secure credential storage using OS keychain
 */
export class Vault {
  private service: string;

  constructor(serviceName: string = SERVICE_NAME) {
    this.service = serviceName;
  }

  /**
   * Generate a vault reference string for a credential
   */
  static generateReference(id: string): string {
    return `${VAULT_PREFIX}${id}`;
  }

  /**
   * Check if a string is a vault reference
   */
  static isReference(value: string): boolean {
    return value.startsWith(VAULT_PREFIX);
  }

  /**
   * Extract credential ID from a vault reference
   */
  static extractId(reference: string): string | null {
    if (!this.isReference(reference)) {
      return null;
    }
    return reference.slice(VAULT_PREFIX.length);
  }

  /**
   * Store a credential in the OS keychain
   */
  async set(service: string, keyType: string, value: string): Promise<Credential> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const credential: Credential = {
      id,
      service,
      keyType,
      createdAt: now,
      updatedAt: now,
    };

    // Store credential metadata and value in keychain
    await keytar.setPassword(this.service, id, JSON.stringify({
      credential,
      value,
    }));

    return credential;
  }

  /**
   * Retrieve a credential value from the OS keychain
   */
  async get(id: string): Promise<VaultEntry | null> {
    const stored = await keytar.getPassword(this.service, id);
    
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as VaultEntry;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Delete a credential from the OS keychain
   */
  async delete(id: string): Promise<boolean> {
    return keytar.deletePassword(this.service, id);
  }

  /**
   * List all credentials in the vault
   */
  async list(): Promise<Credential[]> {
    const credentials: Credential[] = [];
    
    try {
      // keytar doesn't have a list method, so we store a manifest
      const manifest = await keytar.getPassword(this.service, '__manifest__');
      
      if (manifest) {
        const ids = JSON.parse(manifest) as string[];
        
        for (const id of ids) {
          const entry = await this.get(id);
          if (entry) {
            credentials.push(entry.credential);
          }
        }
      }
    } catch {
      // No manifest or error parsing
    }

    return credentials;
  }

  /**
   * Update the manifest with a new credential ID
   */
  private async updateManifest(id: string, add: boolean): Promise<void> {
    const manifest = await keytar.getPassword(this.service, '__manifest__');
    let ids: string[] = [];

    if (manifest) {
      try {
        ids = JSON.parse(manifest) as string[];
      } catch {
        ids = [];
      }
    }

    if (add) {
      if (!ids.includes(id)) {
        ids.push(id);
      }
    } else {
      ids = ids.filter((i) => i !== id);
    }

    await keytar.setPassword(this.service, '__manifest__', JSON.stringify(ids));
  }

  /**
   * Store a credential and update manifest
   */
  async store(service: string, keyType: string, value: string): Promise<Credential> {
    const credential = await this.set(service, keyType, value);
    await this.updateManifest(credential.id, true);
    return credential;
  }

  /**
   * Remove a credential and update manifest
   */
  async remove(id: string): Promise<boolean> {
    const deleted = await this.delete(id);
    if (deleted) {
      await this.updateManifest(id, false);
    }
    return deleted;
  }

  /**
   * Check if the vault is accessible
   */
  async isAccessible(): Promise<boolean> {
    try {
      const testId = '__mcpguard_test__';
      await keytar.setPassword(this.service, testId, 'test');
      const value = await keytar.getPassword(this.service, testId);
      await keytar.deletePassword(this.service, testId);
      return value === 'test';
    } catch {
      return false;
    }
  }
}

export const vault = new Vault();
