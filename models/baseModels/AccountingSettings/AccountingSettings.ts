import { Doc } from 'fyo/model/doc';
import {
  ChangeArg,
  FiltersMap,
  HiddenMap,
  ListsMap,
  ReadOnlyMap,
  ValidationMap,
} from 'fyo/model/types';
import { validateEmail } from 'fyo/model/validationFunction';
import { InventorySettings } from 'models/inventory/InventorySettings';
import { ModelNameEnum } from 'models/types';
import { createDiscountAccount } from 'src/setup/setupInstance';
import { getCountryInfo } from 'utils/misc';
import { SUBSCRIPTION_FEATURES, SubscriptionFeatureKey } from 'utils/subscriptionFeatures';

export class AccountingSettings extends Doc {
  enableDiscounting?: boolean;
  enableInventory?: boolean;
  enablePriceList?: boolean;
  enableLead?: boolean;
  enableCouponCode?: boolean;
  enableFormCustomization?: boolean;
  enableInvoiceReturns?: boolean;
  enableLoyaltyProgram?: boolean;
  enablePricingRule?: boolean;
  enaenableItemEnquiry?: boolean;
  enableERPNextSync?: boolean;
  enablePointOfSaleWithOutInventory?: boolean;
  enablePartialPayment?: boolean;
  enableitemGroup?: boolean;

  static filters: FiltersMap = {
    writeOffAccount: () => ({
      isGroup: false,
      rootType: 'Expense',
    }),
    roundOffAccount: () => ({
      isGroup: false,
      rootType: 'Expense',
    }),
    discountAccount: () => ({
      isGroup: false,
      rootType: 'Income',
    }),
    defaultIncomeAccount: () => ({
      isGroup: false,
      rootType: 'Income',
    }),
    defaultExpenseAccount: () => ({
      isGroup: false,
      rootType: 'Expense',
    }),
  };

  validations: ValidationMap = {
    email: validateEmail,
  };

  static lists: ListsMap = {
    country: () => Object.keys(getCountryInfo()),
  };

  readOnly: ReadOnlyMap = {
    enableDiscounting: () => {
      return !!this.enableDiscounting;
    },
    enableInventory: () => {
      return !!this.enableInventory;
    },
    enableLead: () => {
      return !!this.enableLead;
    },
    enableERPNextSync: () => {
      return !!this.enableERPNextSync;
    },
    enableInvoiceReturns: () => {
      return !!this.enableInvoiceReturns;
    },
    enableLoyaltyProgram: () => {
      return !!this.enableLoyaltyProgram;
    },
    enablePointOfSaleWithOutInventory: () => {
      return !!this.enablePointOfSaleWithOutInventory;
    },
    enableitemGroup: () => {
      return !!this.enableitemGroup;
    },
  };

  override hidden: HiddenMap = {
    discountAccount: () => !this.enableDiscounting,
    gstin: () => this.fyo.singles.SystemSettings?.countryCode !== 'in',
    enablePricingRule: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enablePricingRule, false) ||
      !this.fyo.singles.AccountingSettings?.enableDiscounting,
    enableCouponCode: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableCouponCode, false) ||
      !this.fyo.singles.AccountingSettings?.enablePricingRule,

    // Subscription-controlled feature flags (hide toggles when disabled).
    enableDiscounting: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableDiscounting, false),
    enablePriceList: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enablePriceList, false),
    enableFormCustomization: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableFormCustomization, false),
    enableLead: () => !getSubFeature(this, SUBSCRIPTION_FEATURES.enableLead, false),
    enableItemEnquiry: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableItemEnquiry, false),
    enableLoyaltyProgram: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableLoyaltyProgram, false),
    enableInventory: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableInventory, false),
    enableInvoiceReturns: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableInvoiceReturns, false),
    enableERPNextSync: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableERPNextSync, false),
    enablePointOfSaleWithOutInventory: () =>
      !getSubFeature(
        this,
        SUBSCRIPTION_FEATURES.enablePointOfSaleWithOutInventory,
        false
      ),
    enablePartialPayment: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enablePartialPayment, false),
    enableitemGroup: () =>
      !getSubFeature(this, SUBSCRIPTION_FEATURES.enableitemGroup, false),
  };

  async change(ch: ChangeArg) {
    const discountingEnabled =
      ch.changed === 'enableDiscounting' && this.enableDiscounting;
    const discountAccountNotSet = !this.discountAccount;

    if (discountingEnabled && discountAccountNotSet) {
      await createDiscountAccount(this.fyo);
    }

    if (
      ch.changed == 'enablePointOfSaleWithOutInventory' &&
      this.enablePointOfSaleWithOutInventory
    ) {
      const inventorySettings = (await this.fyo.doc.getDoc(
        ModelNameEnum.InventorySettings
      )) as InventorySettings;

      await inventorySettings.set('enableBatches', true);
      await inventorySettings.set('enableUomConversions', true);
      await inventorySettings.set('enableSerialNumber', true);
      await inventorySettings.set('enableBarcodes', true);
      await inventorySettings.set('enablePointOfSale', true);

      await inventorySettings.sync();
    }
  }
}

function getSubFeature(
  doc: Doc,
  key: SubscriptionFeatureKey,
  defaultValue: boolean
): boolean {
  const raw = doc.fyo?.config?.get('subscriptionFeatures');
  if (!raw || typeof raw !== 'object') return defaultValue;
  const obj = raw as unknown as Record<string, unknown>;
  return typeof obj[key] === 'boolean' ? (obj[key] as boolean) : defaultValue;
}
