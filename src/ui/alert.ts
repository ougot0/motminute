// iOS / Android : boîtes de dialogue natives.
export { Alert } from 'react-native';

export type DialogButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type Dialog = { title: string; message?: string; buttons: DialogButton[] };

/** Utilisé seulement sur le web (voir alert.web.ts). */
export function subscribeDialogs(_fn: (d: Dialog | null) => void) {
  return () => undefined;
}
