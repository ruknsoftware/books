/**
 * Type declaration for optional package books-erpnext-sync-extended.
 * When the package is not installed, runtime import() fails and we keep the default provider.
 */
declare module 'books-erpnext-sync-extended' {
  import type { SyncConfigProvider } from '../utils/syncConfigProvider';
  export function getExtendedSyncConfigProvider(): SyncConfigProvider;
}
