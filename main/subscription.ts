import { safeStorage } from 'electron';
import config from 'utils/config';
import fetch from 'node-fetch';
import { randomBytes } from 'crypto';

const SUBSCRIPTION_SERVER = 'http://localhost:8001';
export const GRACE_PERIOD_DAYS = 1;

/**
 * Call the Frappe server to verify the API token.
 * Token format: "api_key:api_secret"
 */
async function verifyTokenWithServer(
  token: string
): Promise<{ valid: boolean; email: string; message: string }> {
  try {
    const res = await fetch(
      `${SUBSCRIPTION_SERVER}/api/method/rukn_books_subscription.api.validate_api_token`,
      {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`,
        },
      }
    );
    console.log('res', res);
    if (res.status === 200) {
      const body = (await res.json()) as { message: any };
      let email = '';
      if (body.message && typeof body.message === 'object') {
        email = body.message.name || '';
        if (body.message.name) {
          config.set('subscriptionDocname' as any, body.message.name);
        }
        if (body.message.doctype) {
          config.set('subscriptionDoctype' as any, body.message.doctype);
        }
      } else if (typeof body.message === 'string') {
        email = body.message;
      }
      return { valid: true, email, message: 'OK' };
    }

    // 401 or other status
    return { valid: false, email: '', message: 'Invalid or expired token' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, email: '', message: `Connection error: ${msg}` };
  }
}

export default verifyTokenWithServer;

/**
 * Encrypt the token using Electron's safeStorage (OS keychain-backed AES)
 * and store the ciphertext as base64 in electron-store config.
 */
export function storeToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: store plaintext (only for debugging / unsupported OS)
    config.set('subscriptionToken' as any, token);
    return;
  }

  const encrypted = safeStorage.encryptString(token);
  config.set('subscriptionToken' as any, encrypted.toString('base64'));
}

/** Decrypt and return the stored token; returns null if none. */
export function retrieveToken(): string | null {
  const stored = config.get('subscriptionToken' as any) as string | undefined;
  if (!stored) return null;

  if (!safeStorage.isEncryptionAvailable()) {
    return stored; // stored as plaintext fallback
  }

  try {
    const buf = Buffer.from(stored, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

/** Remove the stored token. */
export function clearToken(): void {
  config.delete('subscriptionToken' as any);
  config.delete('subscriptionLastVerifiedAt' as any);
}

/** Get or generate a stable unique instance ID for "Books Instance" doctype. */
export function getInstanceId(): string {
  let id = config.get('subscriptionInstanceId' as any) as string | undefined;
  if (id) return id;

  // Generate a short random ID like "abc123-de456fg7"
  id = randomBytes(8)
    .toString('hex')
    .replace(/(.{6})/, '$1-');
  config.set('subscriptionInstanceId' as any, id);
  return id;
}

/** Record the current time as last successful verification. */
export function setLastVerifiedAt(): void {
  config.set('subscriptionLastVerifiedAt' as any, Date.now());
}

/** Return the timestamp of the last successful verification, or null. */
export function getLastVerifiedAt(): number | null {
  const ts = config.get('subscriptionLastVerifiedAt' as any) as
    | number
    | undefined;
  return ts ?? null;
}

/** Check whether we are within the offline grace period. */
export function isWithinGracePeriod(): boolean {
  const last = getLastVerifiedAt();
  if (last === null) return false;

  const elapsed = Date.now() - last;
  return elapsed < GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Upload the database file to the Frappe server.
 * Uses the /api/method/upload_file endpoint.
 * Builds multipart/form-data manually to avoid extra dependencies.
 */
export async function syncDatabaseToServer(
  dbPath: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const fs = await import('fs-extra');
  const path = await import('path');

  if (!dbPath || !(await fs.pathExists(dbPath))) {
    return { success: false, message: 'No database file found' };
  }

  const instanceId = getInstanceId();
  const fileName = path.basename(dbPath);
  const fileBuffer = await fs.readFile(dbPath);

  // Build multipart/form-data manually
  const boundary = `----BooksSync${Date.now()}${randomBytes(4).toString(
    'hex'
  )}`;
  const CRLF = '\r\n';

  const textFields: Record<string, string> = {
    is_private: '1',
    folder: 'Home/Attachments',
    doctype:
      (config.get('subscriptionDoctype' as any) as string) ||
      'Books Subscription Settings',
    docname: (config.get('subscriptionDocname' as any) as string) || '',
  };

  const parts: Buffer[] = [];

  // Text fields
  for (const [key, value] of Object.entries(textFields)) {
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}` +
          `${value}${CRLF}`
      )
    );
  }

  // File field
  parts.push(
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
        `Content-Type: application/octet-stream${CRLF}${CRLF}`
    )
  );
  parts.push(fileBuffer);
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

  const body = Buffer.concat(parts as unknown as Uint8Array[]);

  try {
    const res = await fetch(`${SUBSCRIPTION_SERVER}/api/method/upload_file`, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (res.status === 200) {
      return { success: true, message: 'Database synced successfully' };
    }

    const errBody = await res.text();
    return {
      success: false,
      message: `Server returned ${res.status}: ${errBody.slice(0, 200)}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Sync failed: ${msg}` };
  }
}
