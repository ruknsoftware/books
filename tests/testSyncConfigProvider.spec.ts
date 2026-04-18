/**
 * T6: Test with default provider only (behavior unchanged).
 * Ensures getSyncConfigProvider returns default and push/fetch/processOrder match original behavior.
 */
import { ModelNameEnum } from 'models/types';
import test from 'tape';
import {
  defaultSyncConfigProvider,
  getSyncConfigProvider,
  setSyncConfigProvider,
} from 'src/utils/syncConfigProvider';
import { getShouldDocSyncToERPNext } from 'src/utils/erpnextSync';

test('default provider: reset and get returns default', (t) => {
  setSyncConfigProvider(null);
  const provider = getSyncConfigProvider();
  t.equal(provider, defaultSyncConfigProvider, 'getSyncConfigProvider returns default when none set');
  t.equal(typeof provider.preSync, 'undefined', 'default provider has no preSync');
  t.end();
});

test('default provider: getPushSyncableDoctypes returns original 5', (t) => {
  setSyncConfigProvider(null);
  const push = getSyncConfigProvider().getPushSyncableDoctypes();
  const expected = [
    ModelNameEnum.SalesInvoice,
    ModelNameEnum.Payment,
    ModelNameEnum.Shipment,
    ModelNameEnum.POSOpeningShift,
    ModelNameEnum.POSClosingShift,
  ];
  t.deepEqual(push, expected, 'push list unchanged');
  t.end();
});

test('default provider: getFetchSyncableDoctypes returns original 5', (t) => {
  setSyncConfigProvider(null);
  const fetch = getSyncConfigProvider().getFetchSyncableDoctypes();
  const expected = [
    ModelNameEnum.Item,
    ModelNameEnum.ItemGroup,
    ModelNameEnum.Batch,
    ModelNameEnum.PricingRule,
    ModelNameEnum.PriceList,
  ];
  t.deepEqual(fetch, expected, 'fetch list unchanged');
  t.end();
});

test('default provider: getInitialSyncProcessOrder masters then SI then Payment', (t) => {
  setSyncConfigProvider(null);
  const order = getSyncConfigProvider().getInitialSyncProcessOrder();
  const expected = [
    ModelNameEnum.UOM,
    ModelNameEnum.ItemGroup,
    ModelNameEnum.Party,
    ModelNameEnum.Address,
    ModelNameEnum.Item,
    ModelNameEnum.PriceList,
    ModelNameEnum.PricingRule,
    ModelNameEnum.Batch,
    ModelNameEnum.SalesInvoice,
    ModelNameEnum.Payment,
  ];
  t.deepEqual(order, expected, 'SalesInvoice before Payment');
  t.end();
});

test('getShouldDocSyncToERPNext: true only for push doctypes', (t) => {
  setSyncConfigProvider(null);
  t.ok(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.SalesInvoice } as any),
    'SalesInvoice should sync'
  );
  t.ok(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.Payment } as any),
    'Payment should sync'
  );
  t.ok(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.Shipment } as any),
    'Shipment should sync'
  );
  t.ok(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.POSOpeningShift } as any),
    'POSOpeningShift should sync'
  );
  t.ok(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.POSClosingShift } as any),
    'POSClosingShift should sync'
  );
  t.end();
});

test('getShouldDocSyncToERPNext: false for non-push doctypes', (t) => {
  setSyncConfigProvider(null);
  t.equal(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.Item } as any),
    false,
    'Item should not sync to ERPNext'
  );
  t.equal(
    getShouldDocSyncToERPNext({ schemaName: ModelNameEnum.Party } as any),
    false,
    'Party should not sync to ERPNext'
  );
  t.end();
});
