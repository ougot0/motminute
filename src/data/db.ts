import { openDatabaseAsync } from 'expo-sqlite';

import { seedDemo } from './demo';
import { Repository, type SqlDb } from './repository';

let opening: Promise<Repository> | null = null;

/** Ouvre (une seule fois) la base locale, applique les migrations, ajoute la démo. */
export function openRepository(): Promise<Repository> {
  if (!opening) {
    opening = (async () => {
      const db = await openDatabaseAsync('motminute.db');
      const repo = new Repository(db as unknown as SqlDb);
      await repo.migrate();
      await seedDemo(repo);
      await repo.recoverInterrupted();
      return repo;
    })();
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}
