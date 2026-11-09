import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Interview } from '../data/repository';
import { formatDate, formatDuration } from '../lib/time';
import { StatusBadge } from './components';
import { colors, HIT, radius, space } from './theme';

export function InterviewRow({ it, progress, onPress, onMore }: { it: Interview; progress?: number; onPress: () => void; onMore?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      testID={`interview-${it.id}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title} numberOfLines={2}>
          {it.title}
        </Text>
        <Text style={styles.meta}>
          {formatDuration(it.durationSec)} · {formatDate(it.createdAt)}
          {it.source === 'demo' ? ' · démo' : ''}
        </Text>
        <StatusBadge status={it.status} progress={progress ?? it.progress} />
      </View>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Actions pour ${it.title}`} style={styles.more}>
          <Text style={styles.moreText}>•••</Text>
        </Pressable>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  more: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 16, color: colors.muted, letterSpacing: 1 },
  chevron: { fontSize: 22, color: colors.faint },
});
