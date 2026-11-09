import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { formatTimestamp } from '../lib/time';
import { colors, fonts, HIT, radius, space } from './theme';

export type PlayerControls = ReturnType<typeof useInterviewPlayer>;

/**
 * Lecteur d'une interview. `seek` fonctionne même avant que le fichier soit
 * chargé : la position est appliquée dès que le lecteur est prêt (cas d'un
 * résultat de recherche qui ouvre l'interview à 18:42).
 */
export function useInterviewPlayer(source: AudioSource | number | null) {
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const pending = useRef<{ t: number; play: boolean } | null>(null);
  // Position affichée immédiatement après un déplacement, avant la mise à jour du lecteur.
  const [optimistic, setOptimisticState] = useState<number | null>(null);
  const optimisticRef = useRef<number | null>(null);
  const setOptimistic = useCallback((v: number | null) => {
    optimisticRef.current = v;
    setOptimisticState(v);
  }, []);

  const apply = useCallback(
    async (t: number, play: boolean) => {
      const target = Math.max(0, player.duration > 0 ? Math.min(t, player.duration) : t);
      setOptimistic(target);
      await player.seekTo(target, 0, 0);
      if (play) player.play();
    },
    [player, setOptimistic],
  );

  const seek = useCallback(
    async (t: number, play = false) => {
      if (player.isLoaded) await apply(t, play);
      else {
        pending.current = { t, play };
        setOptimistic(Math.max(0, t));
      }
    },
    [player, apply, setOptimistic],
  );

  useEffect(() => {
    if (status.isLoaded && pending.current) {
      const p = pending.current;
      pending.current = null;
      apply(p.t, p.play);
    }
  }, [status.isLoaded, apply]);

  // Dès que le lecteur confirme la nouvelle position, on abandonne la valeur provisoire.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      const o = optimisticRef.current;
      if (o !== null && Math.abs(s.currentTime - o) < 1.5) setOptimistic(null);
    });
    return () => sub.remove();
  }, [player, setOptimistic]);

  const toggle = useCallback(() => {
    if (player.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.25)) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [player, status.didJustFinish, status.duration, status.currentTime]);

  const position = optimistic ?? status.currentTime;
  const skip = useCallback((delta: number) => seek(position + delta, player.playing), [seek, position, player]);

  return { player, status, position, duration: status.duration, playing: status.playing, seek, toggle, skip };
}

function SeekBar({ position, duration, onSeek }: { position: number; duration: number; onSeek: (t: number) => void }) {
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const fraction = drag ?? (duration > 0 ? position / duration : 0);
  const at = (e: GestureResponderEvent) => Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
  return (
    <View
      testID="seekbar"
      style={styles.seekHit}
      onLayout={(e: LayoutChangeEvent) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setDrag(at(e))}
      onResponderMove={(e) => setDrag(at(e))}
      onResponderRelease={(e) => {
        const f = at(e);
        setDrag(null);
        if (duration > 0) onSeek(f * duration);
      }}
      onResponderTerminate={() => setDrag(null)}
      accessibilityRole="adjustable"
      accessibilityLabel="Position dans l’audio"
      accessibilityValue={{ text: `${formatTimestamp(position)} sur ${formatTimestamp(duration)}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onSeek(position + (e.nativeEvent.actionName === 'increment' ? 15 : -15))}
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, fraction * 100)}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: Math.min(width - 18, Math.max(0, fraction * width - 9)) }]} />
    </View>
  );
}

function RoundButton({ label, onPress, big, a11y, testID }: { label: string; onPress: () => void; big?: boolean; a11y: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [styles.round, big && styles.roundBig, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.roundText, big && styles.roundTextBig]}>{label}</Text>
    </Pressable>
  );
}

export function PlayerBar({ controls, extra }: { controls: PlayerControls; extra?: React.ReactNode }) {
  const { position, duration, playing, seek, toggle, skip, status } = controls;
  return (
    <View style={styles.bar} testID="player">
      <View style={styles.timeRow}>
        <Text style={styles.time} testID="player-position">
          {formatTimestamp(position)}
        </Text>
        {!status.isLoaded ? <Text style={styles.loading}>Chargement…</Text> : null}
        <Text style={[styles.time, styles.timeMuted]}>{formatTimestamp(duration)}</Text>
      </View>
      <SeekBar position={position} duration={duration} onSeek={(t) => seek(t, playing)} />
      <View style={styles.controls}>
        <RoundButton label="−15" a11y="Reculer de 15 secondes" onPress={() => skip(-15)} testID="back15" />
        <RoundButton big label={playing ? '❚❚' : '▶'} a11y={playing ? 'Pause' : 'Lecture'} onPress={toggle} testID="playpause" />
        <RoundButton label="+15" a11y="Avancer de 15 secondes" onPress={() => skip(15)} testID="fwd15" />
      </View>
      {extra}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontFamily: fonts.mono, fontSize: 17, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  timeMuted: { color: colors.muted, fontWeight: '500' },
  loading: { fontSize: 13, color: colors.faint },
  seekHit: { height: HIT, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    top: (HIT - 18) / 2,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xxl },
  round: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBig: { width: 76, height: 76, backgroundColor: colors.ink },
  roundText: { fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  roundTextBig: { fontSize: 26, color: colors.onInk },
});
