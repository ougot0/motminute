import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { TranscriptionStatus } from '../data/repository';
import { formatTimestamp } from '../lib/time';
import { colors, fonts, HIT, radius, space } from './theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, v.box, pressed && { opacity: 0.75 }, (disabled || loading) && { opacity: 0.45 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color as string} /> : null}
      {icon && !loading ? <Text style={[styles.buttonIcon, v.text]}>{icon}</Text> : null}
      <Text style={[styles.buttonLabel, v.text]}>{label}</Text>
    </Pressable>
  );
}

const buttonVariants: Record<string, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: colors.ink }, text: { color: colors.onInk } },
  secondary: { box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.text } },
  danger: { box: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
};

/** Minutage cliquable, toujours bien visible. */
export function TimeChip({
  seconds,
  onPress,
  large,
  active,
  testID,
}: {
  seconds: number;
  onPress?: () => void;
  large?: boolean;
  /** Passage en cours de lecture : repère menthe. */
  active?: boolean;
  testID?: string;
}) {
  const label = formatTimestamp(seconds);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Écouter à ${label}`}
      style={({ pressed }) => [styles.chip, large && styles.chipLarge, active && styles.chipActive, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipText, large && styles.chipTextLarge, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Highlighted({ text, ranges, style }: { text: string; ranges: [number, number][]; style?: StyleProp<TextStyle> }) {
  if (!ranges.length) return <Text style={style}>{text}</Text>;
  const parts: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], i) => {
    if (a > pos) parts.push(text.slice(pos, a));
    parts.push(
      <Text key={i} style={styles.mark}>
        {text.slice(a, b)}
      </Text>,
    );
    pos = b;
  });
  if (pos < text.length) parts.push(text.slice(pos));
  return <Text style={style}>{parts}</Text>;
}

const STATUS: Record<TranscriptionStatus, { label: string; fg: string; bg: string }> = {
  done: { label: 'Transcrite', fg: colors.ok, bg: colors.okSoft },
  processing: { label: 'Transcription…', fg: colors.warn, bg: colors.warnSoft },
  pending: { label: 'À transcrire', fg: colors.muted, bg: colors.surfaceAlt },
  error: { label: 'Erreur', fg: colors.danger, bg: colors.dangerSoft },
  interrupted: { label: 'Interrompue', fg: colors.danger, bg: colors.dangerSoft },
};

export function StatusBadge({ status, progress }: { status: TranscriptionStatus; progress?: number }) {
  const s = STATUS[status];
  const label = status === 'processing' && progress !== undefined && progress > 0 ? `Transcription ${Math.round(progress * 100)} %` : s.label;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.max(2, Math.min(100, value * 100))}%` }]} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type PromptProps = {
  visible: boolean;
  title: string;
  hint?: string;
  initial: string;
  multiline?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

/** Fenêtre de saisie (renommer, corriger un bloc). Le contenu est recréé à chaque ouverture. */
export function TextPrompt(props: PromptProps) {
  // Sur le web, une superposition dans l'écran (reste dans le cadre iPhone de l'aperçu).
  if (Platform.OS === 'web') {
    return props.visible ? (
      <View style={StyleSheet.absoluteFill}>
        <PromptBody {...props} />
      </View>
    ) : null;
  }
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {props.visible ? <PromptBody {...props} /> : null}
    </Modal>
  );
}

function PromptBody({ title, hint, initial, multiline, confirmLabel = 'Enregistrer', onCancel, onConfirm }: PromptProps) {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        {hint ? <Text style={styles.sheetHint}>{hint}</Text> : null}
        <TextInput
          testID="prompt-input"
          value={value}
          onChangeText={setValue}
          autoFocus
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholderTextColor={colors.faint}
        />
        <View style={styles.row}>
          <Button label="Annuler" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <Button label={confirmLabel} onPress={() => onConfirm(value)} disabled={!value.trim()} style={{ flex: 1 }} testID="prompt-confirm" />
        </View>
      </View>
    </View>
  );
}

/** Menu d'actions affiché dans l'écran (web et Android ; iOS utilise la feuille native). */
export function ChoiceSheet({
  title,
  choices,
  onClose,
}: {
  title: string;
  choices: { label: string; destructive?: boolean; onPress: () => void }[];
  onClose: () => void;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, { justifyContent: 'flex-end' }]}>
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {title}
        </Text>
        {choices.map((c) => (
          <Button
            key={c.label}
            label={c.label}
            variant={c.destructive ? 'danger' : 'secondary'}
            onPress={() => {
              onClose();
              c.onPress();
            }}
          />
        ))}
        <Button label="Annuler" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

/** Confirmation brève (« Citation copiée »). */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMessage(m);
    Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
    }, 1800);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const node = message ? (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  ) : null;
  return { show, node };
}

export const styles = StyleSheet.create({
  button: {
    minHeight: HIT + 4,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonIcon: { fontSize: 17 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  chip: {
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLarge: { minHeight: 40, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.mintSoft },
  chipTextActive: { color: colors.mintText },
  chipText: { fontFamily: fonts.mono, fontWeight: '700', fontSize: 15, color: colors.accent, fontVariant: ['tabular-nums'] },
  chipTextLarge: { fontSize: 18 },
  mark: { backgroundColor: colors.highlight, color: colors.text },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(42,44,48,0.35)', justifyContent: 'center', padding: space.xl },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetHint: { fontSize: 14, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  inputMultiline: { minHeight: 140, textAlignVertical: 'top', fontFamily: fonts.serif, lineHeight: 24 },
  row: { flexDirection: 'row', gap: space.md },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    top: 12,
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  toastText: { color: colors.onInk, fontSize: 15, fontWeight: '600' },
});
