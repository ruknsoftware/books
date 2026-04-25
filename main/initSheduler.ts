import Bree from 'bree';
import fs from 'fs-extra';
import path from 'path';
import main from 'main';
import config from 'utils/config';
import {
  retrieveToken,
  syncDatabaseToServer,
  isWithinGracePeriod,
} from './subscription';
import { emitMainProcessError } from 'backend/helpers';
import pRetry, { AbortError } from 'p-retry';
import databaseManager from 'backend/database/manager';

let bree: Bree;
let inFlightDatabaseSync: Promise<void> | null = null;
let databaseSyncFailureCount = 0;

function getDatabaseSyncInterval(): string {
  const configured = config.get('databaseSyncInterval' as never) as unknown;
  return typeof configured === 'string' && configured.trim()
    ? configured
    : '24 hours';
}

async function runDatabaseSyncWithRetry(): Promise<void> {
  await pRetry(
    async () => {
      // Validity gate: require both a stored token and an in-grace verified subscription.
      const token = retrieveToken();
      if (!token || !isWithinGracePeriod()) {
        databaseSyncFailureCount = 0;
        throw new AbortError(
          '[Sync] Skipping scheduled database sync (no valid token / outside grace period)'
        );
      }


      const backupPath = await databaseManager.createBackup();
      if (!backupPath) {
        throw new AbortError(
          '[Sync] Skipping scheduled database sync (no active database)'
        );
      }

      const result = await syncDatabaseToServer(backupPath, token);
      if (!result?.success) {
        throw new Error(result?.message || 'Database sync failed');
      }

      databaseSyncFailureCount = 0;
    },
    {
      // Keep retrying on transient failures with exponential backoff + jitter.
      retries: 5,
      factor: 2,
      minTimeout: 30_000,
      maxTimeout: 30 * 60_000,
      randomize: true,
      onFailedAttempt: (err) => {
        databaseSyncFailureCount = err.attemptNumber;
        emitMainProcessError(err);
        console.log(
          `[Sync] Database sync failed (attempt ${databaseSyncFailureCount}); retrying...`
        );
      },
    }
  );
}

export async function initScheduler(interval: string) {
  const devJobsRoot = path.join(__dirname, '..', '..', 'jobs');
  const prodJobsRoot = path.join(process.resourcesPath, '..', 'jobs');
  const jobsRoot = main.isDevelopment ? devJobsRoot : prodJobsRoot;

  await fs.ensureDir(jobsRoot);

  if (bree) {
    await bree.stop();
  }

  bree = new Bree({
    root: jobsRoot,
    defaultExtension: 'ts',
    jobs: [
      {
        name: 'triggerErpNextSync',
        interval: interval,
        worker: {
          workerData: {
            useTsNode: true,
          },
        },
      },
      {
        name: 'checkLoyaltyProgramExpiry',
        interval: '24 hours',
        worker: {
          workerData: {
            useTsNode: true,
          },
        },
      },
      {
        name: 'triggerDatabaseSync',
        interval: getDatabaseSyncInterval(),
        worker: {
          workerData: {
            useTsNode: true,
          },
        },
      },
    ],
    worker: {
      argv: ['--require', 'ts-node/register'],
    },
  });

  bree.on('worker created', (name: string) => {
    const worker = bree.workers.get(name);
    if (!worker) return;

    worker.on('message', (message: unknown) => {
      if (message && typeof message === 'object' && 'type' in message) {
        const msg = message as { type: string };
        if (msg.type === 'trigger-erpnext-sync') {
          main.mainWindow?.webContents.send('trigger-erpnext-sync');
        } else if (msg.type === 'trigger-database-sync') {
          // Concurrency guard: do not start another sync while one (incl. retries) is in-flight.
          if (inFlightDatabaseSync) {
            return;
          }

          inFlightDatabaseSync = runDatabaseSyncWithRetry().finally(() => {
            inFlightDatabaseSync = null;
          });
        }
      }
    });

    worker.on('error', (err: unknown) => {
      emitMainProcessError(err);
    });
  });

  await bree.start();
}
