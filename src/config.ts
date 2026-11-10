/**
 * Paramètres à adapter à votre compte App Store Connect.
 * Voir README.md › « Abonnements ».
 */
export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'com.motminute.app.pro.monthly',
  yearly: 'com.motminute.app.pro.yearly',
} as const;

export const SUBSCRIPTION_SKUS: string[] = [SUBSCRIPTION_PRODUCTS.monthly, SUBSCRIPTION_PRODUCTS.yearly];

/** À remplacer par vos pages publiques avant la soumission (exigé par Apple pour les abonnements). */
export const LEGAL_URLS = {
  terms: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  privacy: 'https://example.com/motminute/confidentialite',
};

export const IS_DEV_BUILD = process.env.EXPO_PUBLIC_APP_ENV === 'development' || __DEV__;
