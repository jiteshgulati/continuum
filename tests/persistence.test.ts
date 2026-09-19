import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../server/db';
import { LocalFileStorage } from '../server/storage';

function removeTestDirectory(root: string) {
  const target = resolve(root);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('continuum-')) {
    throw new Error('Refusing to remove a directory outside the generated test directory.');
  }
  rmSync(target, { recursive: true });
}

describe('Persistent storage', () => {
  it('keeps records across connections and rolls back failed transactions', () => {
    const root = mkdtempSync(join(tmpdir(), 'continuum-db-test-'));
    const dbPath = join(root, 'test.sqlite');
    const first = new Store(dbPath);
    first.put('example', {
      id: 'retained',
      orgId: 'org-one',
      createdAt: new Date().toISOString(),
      value: 'persisted',
    });
    expect(() =>
      first.transaction(() => {
        first.put('example', {
          id: 'rolled-back',
          orgId: 'org-one',
          createdAt: new Date().toISOString(),
        });
        throw new Error('Simulated failure');
      }),
    ).toThrow('Simulated failure');
    first.close();
    const second = new Store(dbPath);
    try {
      expect(second.get('example', 'retained', 'org-one')).toMatchObject({ value: 'persisted' });
      expect(second.get('example', 'retained', 'another-org')).toBeUndefined();
      expect(second.get('example', 'rolled-back', 'org-one')).toBeUndefined();
    } finally {
      second.close();
      removeTestDirectory(root);
    }
  });
  it('stores originals and rejects path traversal and overwrites', async () => {
    const root = mkdtempSync(join(tmpdir(), 'continuum-files-test-'));
    const files = new LocalFileStorage(root);
    try {
      await files.put('original-note.md', Buffer.from('Preserved evidence'));
      expect((await files.read('original-note.md')).toString()).toBe('Preserved evidence');
      await expect(files.put('original-note.md', Buffer.from('Changed'))).rejects.toThrow();
      await expect(files.read('../secret.txt')).rejects.toThrow('Invalid file key');
    } finally {
      removeTestDirectory(root);
    }
  });
});
