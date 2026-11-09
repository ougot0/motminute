import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { IS_DEV_BUILD } from '../config';
import { seedDemo } from '../data/demo';
import { formatDate } from '../lib/time';
import { nativeEngine, osVersionInfo } from '../services/nativeEngine';
import { runSemanticDiagnostic, semanticAvailable, type ProbeReport } from '../services/semantic';
import { engineMessage, type EngineAvailability } from '../services/transcriptionRunner';
import { useApp } from '../state/AppState';
import { Alert } from '../ui/alert';
import { Button, Card, ProgressBar } from '../ui/components';
import { colors, space } from '../ui/theme';

export default function SettingsScreen() {
  const { repo, bump, quota, isPro, entitlement, devPro, setDevPro, semanticEnabled, setSemanticEnabled } = useApp();
  const [engine, setEngine] = useState<EngineAvailability | null>(null);
  const [os, setOs] = useState<string | undefined>();
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [semAvail, setSemAvail] = useState<boolean | null>(null);
  const [report, setReport] = useState<ProbeReport | null>(null);

  const refreshEngine = () => {
    nativeEngine.availability('fr-FR').then(setEngine);
    osVersionInfo().then(setOs);
  };
  useEffect(() => {
    refreshEngine();
    semanticAvailable().then(setSemAvail);
  }, []);

  const downloadModel = async () => {
    setModelProgress(0);
    try {
      await nativeEngine.ensureModel('fr-FR', setModelProgress);
    } catch (e) {
      Alert.alert('Téléchargement impossible', String((e as Error)?.message ?? e));
    } finally {
      setModelProgress(null);
      refreshEngine();
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h2}>Abonnement</Text>
      <Card style={styles.card}>
        <Text style={styles.strong}>{isPro ? 'MotMinute Pro' : 'Version gratuite'}</Text>
        {isPro && entitlement?.expiresAt ? <Text style={styles.body}>Renouvellement ou fin : {formatDate(entitlement.expiresAt)}</Text> : null}
        <Text style={styles.body}>
          Transcriptions terminées : {Math.round(quota.usedSeconds / 60)} min
          {quota.limitSeconds ? ` sur ${quota.limitSeconds / 60} min gratuites` : ''}. Seuls les traitements terminés sont comptés.
        </Text>
        {quota.limitSeconds ? <ProgressBar value={quota.usedSeconds / quota.limitSeconds} /> : null}
        {!isPro ? <Button label="Découvrir MotMinute Pro" onPress={() => router.push('/paywall')} /> : null}
        <Button label="Restaurer mes achats" variant="secondary" onPress={() => router.push('/paywall')} />
        {IS_DEV_BUILD ? (
          <View style={styles.switchRow}>
            <Text style={[styles.body, { flex: 1 }]}>Simuler Pro (build de développement uniquement)</Text>
            <Switch value={devPro} onValueChange={setDevPro} />
          </View>
        ) : null}
      </Card>

      <Text style={styles.h2}>Transcription</Text>
      <Card style={styles.card}>
        <Text style={styles.strong}>Apple SpeechAnalyzer · français · sur l’iPhone</Text>
        <Text style={styles.body}>
          {Platform.OS === 'web'
            ? 'Aperçu web : la transcription n’est pas disponible ici. Elle fonctionne dans l’app iPhone (iOS 26).'
            : engine
              ? engineMessage(engine)
              : 'Vérification…'}
        </Text>
        {os ? <Text style={styles.small}>iOS {os}</Text> : null}
        {engine === 'needs-download' ? (
          modelProgress !== null ? (
            <ProgressBar value={modelProgress} />
          ) : (
            <Button label="Télécharger le modèle français" variant="secondary" onPress={downloadModel} />
          )
        ) : null}
        <Text style={styles.small}>Les minutages affichés sont ceux fournis par le moteur pour chaque mot. Gardez l’app ouverte pendant un traitement.</Text>
      </Card>

      <Text style={styles.h2}>Recherche</Text>
      <Card style={styles.card}>
        <Text style={styles.strong}>Recherche textuelle (active)</Text>
        <Text style={styles.body}>
          Accents et majuscules ignorés, expressions exactes en premier, formes d’un même mot rapprochées et lexique de reformulations françaises
          (ex. « démissionner » ≈ « quitter mon poste »). Mettez une expression entre guillemets pour une recherche exacte.
        </Text>
        <Text style={styles.strong}>Recherche par sens : {semanticEnabled ? 'activée (expérimental)' : 'non activée'}</Text>
        <Text style={styles.body}>
          {semAvail === null
            ? 'Vérification…'
            : semAvail
              ? 'Un modèle de phrases local (Apple NaturalLanguage) est présent. Sa qualité en français n’a pas encore été validée : lancez le diagnostic avant de l’activer.'
              : 'Aucun modèle local de phrases en français n’est disponible ici. Seule la recherche textuelle fonctionne.'}
        </Text>
        {semAvail ? (
          <>
            <Button
              label="Lancer le diagnostic sur cet iPhone"
              variant="secondary"
              onPress={async () => {
                try {
                  setReport(await runSemanticDiagnostic());
                } catch (e) {
                  Alert.alert('Diagnostic impossible', String((e as Error)?.message ?? e));
                }
              }}
            />
            {report ? (
              <View style={{ gap: 4 }}>
                <Text style={styles.body}>
                  Résultat : {report.passed}/{report.total} reformulations retrouvées en tête.
                </Text>
                {report.details.map((d) => (
                  <Text key={d.query} style={styles.small}>
                    {d.ok ? '✓' : '✗'} « {d.query} » → {d.best}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.switchRow}>
              <Text style={[styles.body, { flex: 1 }]}>Activer la recherche par sens (expérimental)</Text>
              <Switch value={semanticEnabled} onValueChange={setSemanticEnabled} />
            </View>
          </>
        ) : null}
      </Card>

      <Text style={styles.h2}>Démo et données</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>Audios, transcriptions et citations restent dans le stockage privé de MotMinute sur cet iPhone.</Text>
        <Button
          label="Restaurer l’interview démo"
          variant="secondary"
          onPress={async () => {
            if (!repo) return;
            await seedDemo(repo, { force: true });
            bump();
            Alert.alert('Démo restaurée', 'L’interview démo est de nouveau dans la bibliothèque.');
          }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  h2: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.md },
  card: { gap: space.md },
  strong: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
