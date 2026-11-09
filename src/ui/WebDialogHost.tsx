import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { subscribeDialogs, type Dialog } from './alert';
import { Button } from './components';
import { colors, radius, space } from './theme';

/** Affiche les dialogues de l'aperçu web à l'intérieur du cadre iPhone. */
export function WebDialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => subscribeDialogs(setDialog), []);
  if (!dialog) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} accessibilityViewIsModal>
      <View style={styles.box} accessibilityRole="alert">
        <Text style={styles.title}>{dialog.title}</Text>
        {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
        <View style={styles.buttons}>
          {dialog.buttons.map((b, i) => (
            <Button
              key={i}
              label={b.text ?? 'OK'}
              variant={b.style === 'destructive' ? 'danger' : b.style === 'cancel' ? 'secondary' : 'primary'}
              style={{ flexGrow: 1 }}
              onPress={() => {
                setDialog(null);
                b.onPress?.();
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(42,44,48,0.35)', justifyContent: 'center', padding: space.xl, zIndex: 100 },
  box: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 15, color: colors.text, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
});
