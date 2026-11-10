import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEGAL_URLS } from '../config';
import { formatDuration } from '../lib/time';
import { buySubscription, fetchSubscriptionProducts, restoreSubscriptions, type StoreProduct } from '../services/subscriptions';
import { useApp } from '../state/AppState';
import { Alert } from '../ui/alert';
import { Button, Card } from '../ui/components';
import { colors, radius, space } from '../ui/theme';

export default function PaywallScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { quota, isPro, refreshEntitlement, storeError } = useApp();
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionProducts().then(
      (p) => setProducts(p),
      (e) => {
        setProducts([]);
        setLoadError(String(e?.message ?? e));
      },
    );
  }, []);

  const buy = async (p: StoreProduct) => {
    setBusy(p.id);
    try {
      await buySubscription(p.id);
      await refreshEntitlement();
    } catch (e) {
      Alert.alert('Achat impossible', String((e as Error)?.message ?? e));
    } finally {
      setTimeout(() => setBusy(null), 1500);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const e = await restoreSubscriptions();
      await refreshEntitlement();
      Alert.alert(e?.active ? 'Abonnement restauré' : 'Aucun abonnement actif', e?.active ? 'MotMinute Pro est actif.' : 'Aucun abonnement MotMinute Pro n’a été trouvé pour ce compte Apple.');
    } catch (e) {
      Alert.alert('Restauration impossible', String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {reason === 'export' ? (
        <Card style={{ backgroundColor: colors.accentSoft }}>
          <Text style={styles.body}>Copier toutes les citations ou une transcription complète d’un coup fait partie de MotMinute Pro. La copie citation par citation reste gratuite.</Text>
        </Card>
      ) : null}
      {reason === 'quota' ? (
        <Card style={{ backgroundColor: colors.warnSoft }}>
          <Text style={styles.body}>
            Cette interview dépasse votre quota gratuit (reste {formatDuration(quota.remainingSeconds ?? 0)} sur 60 min). Elle reste importée : vous
            pourrez la transcrire plus tard.
          </Text>
        </Card>
      ) : null}
      {isPro ? (
        <Card style={{ backgroundColor: colors.okSoft, gap: space.md }}>
          <Text style={styles.body}>MotMinute Pro est actif. Merci !</Text>
          <Button label="Continuer" onPress={() => router.back()} />
        </Card>
      ) : null}
      <Text style={styles.h1}>Transcrivez toutes vos interviews</Text>
      <View style={styles.bullets}>
        <Text style={styles.bullet}>• Nouvelles transcriptions sans quota mensuel</Text>
        <Text style={styles.bullet}>• Toujours sur l’iPhone : l’audio ne quitte pas l’appareil</Text>
        <Text style={styles.bullet}>• Export des citations et des transcriptions complètes</Text>
        <Text style={styles.bullet}>• À l’expiration, vos interviews et citations restent accessibles</Text>
      </View>

      {products === null ? (
        <ActivityIndicator color={colors.text} />
      ) : Platform.OS === 'web' ? (
        <View style={{ gap: space.md }}>
          <Text style={[styles.small, { color: colors.warn, fontWeight: '700' }]}>
            PRIX D’EXEMPLE — aperçu web. Sur iPhone, les prix affichés sont ceux renvoyés par l’App Store.
          </Text>
          {[
            { id: 'm', label: 'Mensuel', price: '11,99 € / mois' },
            { id: 'y', label: 'Annuel', price: '99,99 € / an' },
          ].map((p) => (
            <View key={p.id} style={[styles.product, { opacity: 0.6 }]}>
              <Text style={[styles.productTitle, { flex: 1 }]}>{p.label} (exemple)</Text>
              <Text style={styles.price}>{p.price}</Text>
            </View>
          ))}
        </View>
      ) : products.length ? (
        products.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => buy(p)}
            disabled={busy !== null}
            accessibilityRole="button"
            style={({ pressed }) => [styles.product, pressed && { opacity: 0.8 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.productTitle}>{p.period === 'year' ? 'Annuel' : p.period === 'month' ? 'Mensuel' : p.title}</Text>
              <Text style={styles.productSub}>{p.title}</Text>
            </View>
            {busy === p.id ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.price}>
                {p.displayPrice}
                {p.period === 'year' ? ' / an' : p.period === 'month' ? ' / mois' : ''}
              </Text>
            )}
          </Pressable>
        ))
      ) : (
        <Card>
          <Text style={styles.body}>
            Les abonnements ne sont pas disponibles pour le moment (produits App Store non configurés ou App Store inaccessible). La version
            gratuite et la démo restent utilisables.
          </Text>
          {loadError ? <Text style={styles.small}>{loadError}</Text> : null}
        </Card>
      )}
      {storeError ? <Text style={[styles.small, { color: colors.danger }]}>{storeError}</Text> : null}

      <Button label="Restaurer mes achats" variant="secondary" onPress={restore} loading={busy === 'restore'} />
      <Text style={styles.small}>
        Abonnement à renouvellement automatique, résiliable à tout moment dans Réglages › Identifiant Apple › Abonnements. Le paiement est débité
        sur votre compte Apple à la confirmation de l’achat.
      </Text>
      <View style={styles.links}>
        <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
          Conditions d’utilisation
        </Text>
        <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
          Confidentialité
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg },
  h1: { fontSize: 26, fontWeight: '700', color: colors.text, lineHeight: 32 },
  bullets: { gap: space.sm },
  bullet: { fontSize: 16, color: colors.text, lineHeight: 22 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    minHeight: 72,
  },
  productTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  productSub: { fontSize: 13, color: colors.muted },
  price: { fontSize: 18, fontWeight: '700', color: colors.text },
  links: { flexDirection: 'row', gap: space.xl, justifyContent: 'center' },
  link: { fontSize: 14, color: colors.text, textDecorationLine: 'underline', paddingVertical: space.sm },
});
