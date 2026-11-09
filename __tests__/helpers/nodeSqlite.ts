// Adaptateur de test : vrai SQLite (node:sqlite) sur un fichier, même interface qu'expo-sqlite.
import type { SqlDb, SqlParam } from '../../src/data/repository';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

export type ClosableDb = SqlDb & { close(): void };

export function openNodeDb(path: string): ClosableDb {
  const db = new DatabaseSync(path);
  return {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, params: SqlParam[]) {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: SqlParam[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[]) {
      return (db.prepare(sql).get(...params) ?? null) as T | null;
    },
    close() {
      db.close();
    },
  };
}
