import * as Clipboard from 'expo-clipboard';

/** Copie un texte ; renvoie false si le système le refuse (ex. aperçu web dans un cadre). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
