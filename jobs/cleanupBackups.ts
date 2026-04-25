import fs from 'fs-extra';
import path from 'path';
import config from '../utils/config';
import { emitMainProcessError } from '../backend/helpers';

const KEEP_MOST_RECENT = 3;

async function cleanupDir(dirPath: string): Promise<void> {
  try {
    if (!(await fs.pathExists(dirPath))) return;

    const entries = await fs.readdir(dirPath);
    const candidates = entries.filter((name) => name.endsWith('.books.db'));

    const stats = await Promise.all(
      candidates.map(async (name) => {
        const fullPath = path.join(dirPath, name);
        const stat = await fs.stat(fullPath);
        return { fullPath, mtimeMs: stat.mtimeMs };
      })
    );

    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const toDelete = stats.slice(Math.max(KEEP_MOST_RECENT, 0));
    await Promise.all(toDelete.map((f) => fs.remove(f.fullPath)));
  } catch (err) {
    emitMainProcessError(err);
    // eslint-disable-next-line no-console
    console.log('[Cleanup] Backup retention cleanup failed (non-fatal).');
  }
}

async function cleanupBackups(): Promise<void> {
  try {
    const files = config.get('files') ?? [];
    for (const file of files) {
      if (!file?.dbPath || typeof file.dbPath !== 'string') continue;
      const backupsDir = path.join(path.dirname(file.dbPath), 'backups');
      await cleanupDir(backupsDir);
    }
  } catch (err) {
    emitMainProcessError(err);
  }
}

cleanupBackups().catch((err) => {
  emitMainProcessError(err);
});

