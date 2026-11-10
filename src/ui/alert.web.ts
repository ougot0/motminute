// Web : React Native Web n'affiche pas Alert.alert, et l'aperçu bloque alert()/confirm().
// Les dialogues sont donc dessinés dans l'app par <WebDialogHost /> (voir RootStack).
export type DialogButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type Dialog = { title: string; message?: string; buttons: DialogButton[] };

let listener: ((d: Dialog | null) => void) | null = null;

export function subscribeDialogs(fn: (d: Dialog | null) => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export const Alert = {
  alert(title: string, message?: string, buttons?: DialogButton[]) {
    listener?.({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
  },
};
