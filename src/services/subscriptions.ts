import { SUBSCRIPTION_SKUS } from '../config';

/**
 * Abonnements intégrés (StoreKit 2 via expo-iap).
 *
 * expo-iap est chargé à la demande : si le module natif manque (Expo Go, web,
 * tests) ou si les produits ne sont pas configurés dans App Store Connect,
 * l'app reste utilisable en version gratuite.
 */

export type StoreProduct = {
  id: string;
  title: string;
  /** Prix formaté renvoyé par l'App Store (devise et pays de l'utilisateur). */
  displayPrice: string;
  period: 'month' | 'year' | 'unknown';
};

export type Entitlement = { active: boolean; productId: string | null; expiresAt: number | null; checkedAt: number };

type IapModule = typeof import('expo-iap');

let iapModule: IapModule | null | undefined;

function iap(): IapModule | null {
  if (iapModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      iapModule = require('expo-iap') as IapModule;
    } catch {
      iapModule = null;
    }
  }
  return iapModule;
}

let connected: Promise<boolean> | null = null;

export function connectStore(): Promise<boolean> {
  const m = iap();
  if (!m) return Promise.resolve(false);
  if (!connected) {
    connected = m.initConnection().then(
      (ok) => Boolean(ok),
      () => {
        connected = null;
        return false;
      },
    );
  }
  return connected;
}

function periodOf(p: Record<string, unknown>): StoreProduct['period'] {
  const unit = String(p.subscriptionPeriodUnitIOS ?? (p.subscriptionInfoIOS as { subscriptionPeriod?: { unit?: string } } | undefined)?.subscriptionPeriod?.unit ?? '').toLowerCase();
  if (unit.includes('year')) return 'year';
  if (unit.includes('month')) return 'month';
  const id = String(p.id ?? '');
  if (id.includes('year') || id.includes('annual')) return 'year';
  if (id.includes('month')) return 'month';
  return 'unknown';
}

export async function fetchSubscriptionProducts(): Promise<StoreProduct[]> {
  const m = iap();
  if (!m || !(await connectStore())) return [];
  const products = ((await m.fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' })) ?? []) as unknown as Record<string, unknown>[];
  return products
    .map((p) => ({
      id: String(p.id),
      title: String(p.displayNameIOS ?? p.displayName ?? p.title ?? p.id),
      displayPrice: String(p.displayPrice ?? ''),
      period: periodOf(p),
    }))
    .sort((a, b) => (a.period === b.period ? 0 : a.period === 'month' ? -1 : 1));
}

export async function readEntitlement(): Promise<Entitlement | null> {
  const m = iap();
  if (!m || !(await connectStore())) return null;
  const subs = await m.getActiveSubscriptions(SUBSCRIPTION_SKUS);
  const active = subs.find((s) => s.isActive && SUBSCRIPTION_SKUS.includes(s.productId));
  return {
    active: Boolean(active),
    productId: active?.productId ?? null,
    expiresAt: active?.expirationDateIOS ?? null,
    checkedAt: Date.now(),
  };
}

export async function buySubscription(sku: string): Promise<void> {
  const m = iap();
  if (!m || !(await connectStore())) throw new Error('L’App Store n’est pas disponible sur cet appareil.');
  await m.requestPurchase({ request: { apple: { sku } }, type: 'subs' });
}

export async function restoreSubscriptions(): Promise<Entitlement | null> {
  const m = iap();
  if (!m || !(await connectStore())) throw new Error('L’App Store n’est pas disponible sur cet appareil.');
  await m.restorePurchases();
  return readEntitlement();
}

/** Écoute les achats aboutis : on clôt la transaction puis on relit les droits. */
export function listenToPurchases(onChange: () => void, onError: (message: string) => void): () => void {
  const m = iap();
  if (!m) return () => undefined;
  const a = m.purchaseUpdatedListener(async (purchase) => {
    try {
      await m.finishTransaction({ purchase, isConsumable: false });
    } finally {
      onChange();
    }
  });
  const b = m.purchaseErrorListener((err) => {
    const code = String((err as { code?: string }).code ?? '');
    if (/cancel/i.test(code)) return;
    onError(err.message || 'Achat impossible.');
  });
  return () => {
    a.remove();
    b.remove();
  };
}

/** Pro si l'App Store le confirme ; hors ligne, on se fie au dernier état connu tant qu'il n'a pas expiré. */
export function isEntitlementActive(e: Entitlement | null, now = Date.now()): boolean {
  if (!e) return false;
  if (!e.active) return false;
  if (e.expiresAt && e.expiresAt < now) return false;
  return true;
}
