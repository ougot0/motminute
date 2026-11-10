import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTimestamp } from '../lib/time';
import { adoptRecording } from '../services/audioFiles';
import { useApp } from '../state/AppState';
import { Alert } from '../ui/alert';
import { Button } from '../ui/components';
import { colors, fonts, radius, space } from '../ui/theme';
import { useAddInterview } from '../ui/useImport';

const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** Enregistrer une interview avec le micro de l'iPhone, puis la transcrire. */
export default function RecordScreen() {
  const { quota } = useApp();
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 200);
  const { add } = useAddInterview();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused' | 'saving'>('idle');
  const [moments, setMoments] = useState<number[]>([]);
  const web = Platform.OS === 'web';

  useEffect(
    () => () => {
      setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    [],
  );

  const start = async () => {
    if (web) {
      Alert.alert('Aperçu web', 'L’enregistrement fonctionne dans l’app iPhone. Ici, essayez l’interview démo.');
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Micro refusé', 'Autorisez le micro pour MotMinute dans Réglages › Confidentialité et sécurité › Micro.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  };

  const togglePause = () => {
    if (phase === 'recording') {
      recorder.pause();
      setPhase('paused');
    } else {
      recorder.record();
      setPhase('recording');
    }
  };

  const finish = async () => {
    setPhase('saving');
    const seconds = state.durationMillis / 1000;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (!recorder.uri || seconds < 1) {
      setPhase('idle');
      Alert.alert('Enregistrement vide', 'Rien n’a été enregistré.');
      return;
    }
    try {
      const audio = await adoptRecording(recorder.uri, seconds);
      router.back();
      await add(audio, moments);
    } catch (e) {
      setPhase('idle');
      Alert.alert('Enregistrement non sauvegardé', e instanceof Error ? e.message : String(e));
    }
  };

  // niveau du micro : -60 dB (silence) → 0 dB
  const level = Math.max(0, Math.min(1, ((state.metering ?? -60) + 60) / 60));
  const active = phase === 'recording' || phase === 'paused';

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.time} testID="record-time">
          {formatTimestamp(state.durationMillis / 1000)}
        </Text>
        <Text style={styles.status}>
          {phase === 'recording' ? '● Enregistrement en cours' : phase === 'paused' ? 'En pause' : phase === 'saving' ? 'Sauvegarde…' : 'Prêt à enregistrer'}
        </Text>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${active ? Math.round(level * 100) : 0}%` }]} />
        </View>
      </View>

      <Pressable
        testID="record-button"
        onPress={active ? finish : start}
        disabled={phase === 'saving'}
        accessibilityRole="button"
        accessibilityLabel={active ? 'Arrêter et transcrire' : 'Commencer l’enregistrement'}
        style={({ pressed }) => [styles.big, active && styles.bigActive, pressed && { opacity: 0.85 }]}
      >
        <View style={active ? styles.stopSquare : styles.recDot} />
      </Pressable>
      <Text style={styles.hint}>{active ? 'Touchez pour arrêter : la transcription démarre aussitôt' : 'Touchez pour enregistrer l’interview'}</Text>

      {active ? (
        <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
          <Button label={phase === 'paused' ? 'Reprendre' : 'Pause'} variant="secondary" onPress={togglePause} style={{ flex: 1 }} />
          <Button
            label={`⚑ Moment fort${moments.length ? ` (${moments.length})` : ''}`}
            variant="secondary"
            onPress={() => setMoments((m) => [...m, state.durationMillis / 1000])}
            style={{ flex: 1 }}
            testID="record-marker"
          />
        </View>
      ) : null}

      <View style={styles.tips}>
        <Text style={styles.tip}>• Posez l’iPhone près de la personne interviewée.</Text>
        <Text style={styles.tip}>• L’enregistrement continue écran verrouillé.</Text>
        <Text style={styles.tip}>• « Moment fort » pose un repère : vous le retrouverez dans la transcription.</Text>
        <Text style={styles.tip}>
          • {quota.isPro ? 'Transcription illimitée avec Pro.' : `Transcription gratuite restante : ${Math.floor((quota.remainingSeconds ?? 0) / 60)} min.`}
        </Text>
        {web ? <Text style={[styles.tip, { color: colors.warn }]}>Aperçu web : l’enregistrement est désactivé ici.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', padding: space.xl, gap: space.lg },
  top: { alignItems: 'center', gap: space.sm, alignSelf: 'stretch', marginTop: space.lg },
  time: { fontFamily: fonts.mono, fontSize: 52, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  status: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  meter: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: space.sm },
  meterFill: { height: 6, backgroundColor: colors.mint },
  big: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    borderWidth: 6,
    borderColor: colors.accentSoft,
  },
  bigActive: { backgroundColor: colors.danger, borderColor: colors.dangerSoft },
  recDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.onInk },
  stopSquare: { width: 34, height: 34, borderRadius: 6, backgroundColor: colors.onInk },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  tips: { alignSelf: 'stretch', gap: 6, marginTop: 'auto', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg },
  tip: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
