/**
 * T11: Test with extension installed (extended provider active).
 * Verifies extended push/fetch lists and preSync behavior.
 */
import test from 'tape';
import {
  getSyncConfigProvider,
  syncConfigRegistrationReady,
} from 'src/utils/syncConfigProvider';
import { getShouldDocSyncToERPNext } from 'src/utils/erpnextSync';

test('extended provider is registered when installed', async (t) => {
  // Wait for optional registration.
  await syncConfigRegistrationReady;

  const provider = getSyncConfigProvider();
  const push = provider.getPushSyncableDoctypes();
  const fetch = provider.getFetchSyncableDoctypes();

  t.ok(push.length > 5, 'push list should be extended (more than default 5)');
  t.ok(fetch.includes('Address'), 'fetch list should include Address');
  t.ok(push.includes('Item'), 'push list should include Item');
  t.equal(typeof provider.preSync, 'function', 'extended provider should define preSync');

  t.equal(
    getShouldDocSyncToERPNext({ schemaName: 'Item' } as any),
    true,
    'Item should sync to ERPNext when extended provider is active'
  );
  t.end();
});

test('extended preSync queues missing dependencies', async (t) => {
  await syncConfigRegistrationReady;

  const provider = getSyncConfigProvider();
  if (!provider.preSync) {
    t.fail('expected provider.preSync to be defined');
    t.end();
    return;
  }

  const queued: Array<{ referenceType: string; documentName: string }> = [];
  const fyo = {
    db: {
      exists: async () => false,
    },
  };

  await provider.preSync(
    fyo as any,
    {
      doctype: 'Shipment',
      party: 'CUST-001',
      items: [{ item: 'ITEM-001' }, { item: 'ITEM-002' }],
    } as any,
    {
      addToFetchFromERPNextQueue: async (_fyo, data) => {
        queued.push(data);
      },
    }
  );

  t.deepEqual(
    queued,
    [
      { referenceType: 'Party', documentName: 'CUST-001' },
      { referenceType: 'Item', documentName: 'ITEM-001' },
      { referenceType: 'Item', documentName: 'ITEM-002' },
    ],
    'Shipment preSync should queue Party and Items when missing'
  );
  t.end();
});

