/**
 * Contract for ERPNext sync configuration (push list, fetch list, process order, optional preSync).
 * Used by erpnextSync to decide which doctypes sync and in what order; can be replaced by an
 * extension (e.g. books-erpnext-sync-extended) for full sync.
 */
import type { Fyo } from 'fyo';
import type { DocValueMap } from 'fyo/core/types';
import { ModelNameEnum } from 'models/types';

export interface SyncConfigProvider {
  /** Doctypes that are pushed from Books to ERPNext (e.g. SalesInvoice, Payment, Shipment). */
  getPushSyncableDoctypes(): string[];

  /** Doctypes that are accepted when fetching incrementally from ERPNext to Books. */
  getFetchSyncableDoctypes(): string[];

  /** Order in which doctypes are processed during initial full sync (masters before transactions). */
  getInitialSyncProcessOrder(): string[];

  /**
   * Optional hook run before syncing a document (create/update from ERPNext).
   * Use to ensure dependencies exist or are queued (e.g. add to FetchFromERPNextQueue).
   */
  preSync?(fyo: Fyo, doc: DocValueMap): Promise<void> | void;
}

/** Default provider: current 5 push doctypes, current fetch list, current initial sync order. No preSync. */
export const defaultSyncConfigProvider: SyncConfigProvider = {
  getPushSyncableDoctypes(): string[] {
    return [
      ModelNameEnum.SalesInvoice,
      ModelNameEnum.Payment,
      ModelNameEnum.Shipment,
      ModelNameEnum.POSOpeningShift,
      ModelNameEnum.POSClosingShift,
    ];
  },

  getFetchSyncableDoctypes(): string[] {
    return [
      ModelNameEnum.Item,
      ModelNameEnum.ItemGroup,
      ModelNameEnum.Batch,
      ModelNameEnum.PricingRule,
      ModelNameEnum.PriceList,
    ];
  },

  getInitialSyncProcessOrder(): string[] {
    return [
      ModelNameEnum.UOM,
      ModelNameEnum.ItemGroup,
      ModelNameEnum.Party,
      ModelNameEnum.Address,
      ModelNameEnum.Item,
      ModelNameEnum.PriceList,
      ModelNameEnum.PricingRule,
      ModelNameEnum.Batch,
    ];
  },
};
