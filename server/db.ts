import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Base, Audit } from './types';

export class Store {
  db: DatabaseSync;
  constructor(path = process.env.DATABASE_PATH || './data/continuum.sqlite') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL, id TEXT PRIMARY KEY, org_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_org ON records(kind,org_id);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts(email TEXT PRIMARY KEY,user_id TEXT UNIQUE NOT NULL);`);
  }
  all<T extends Base>(kind: string, orgId: string): T[] {
    return (
      this.db
        .prepare('SELECT data FROM records WHERE kind=? AND org_id=? ORDER BY rowid DESC')
        .all(kind, orgId) as { data: string }[]
    ).map((x) => JSON.parse(x.data));
  }
  get<T extends Base>(kind: string, id: string, orgId: string): T | undefined {
    const row = this.db
      .prepare('SELECT data FROM records WHERE kind=? AND id=? AND org_id=?')
      .get(kind, id, orgId) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  put<T extends Base>(kind: string, value: T): T {
    this.db
      .prepare(
        'INSERT INTO records(kind,id,org_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.org_id=excluded.org_id AND records.kind=excluded.kind',
      )
      .run(kind, value.id, value.orgId, JSON.stringify(value));
    return value;
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  base(orgId: string): Base {
    return { id: randomUUID(), orgId, createdAt: new Date().toISOString() };
  }
  audit(orgId: string, actor: string, entityId: string, action: string, detail = '') {
    this.put<Audit>('audit', { ...this.base(orgId), actor, entityId, action, detail });
  }
  close() {
    this.db.close();
  }
}
