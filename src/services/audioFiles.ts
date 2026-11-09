import { createAudioPlayer, type AudioSource } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { MotMinuteSpeech } from '../../modules/motminute-speech';
import { DEMO_AUDIO_REF } from '../data/demo';

export const SUPPORTED_EXTENSIONS = ['m4a', 'mp3', 'wav'] as const;

const DEMO_AUDIO = require('../../assets/demo/demo-interview.m4a');

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

function interviewsDir(): Directory {
  const dir = new Directory(Paths.document, 'interviews');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * On ne stocke que le NOM du fichier : le chemin absolu du conteneur de l'app
 * change à chaque mise à jour iOS, le nom reste valable.
 */
export function audioFileFor(ref: string): File {
  return new File(interviewsDir(), ref);
}

export function audioSourceFor(ref: string): AudioSource | number {
  if (ref === DEMO_AUDIO_REF) return DEMO_AUDIO;
  return { uri: audioFileFor(ref).uri };
}

export function audioExists(ref: string): boolean {
  if (ref === DEMO_AUDIO_REF) return true;
  try {
    return audioFileFor(ref).exists;
  } catch {
    return false;
  }
}

export function deleteAudio(ref: string): void {
  if (ref === DEMO_AUDIO_REF) return;
  try {
    const f = audioFileFor(ref);
    if (f.exists) f.delete();
  } catch {
    // fichier déjà absent
  }
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Interview sans titre';
}

/** Durée réelle du fichier ; lève ImportError si iOS ne sait pas le lire. */
async function probeDuration(uri: string): Promise<number> {
  if (MotMinuteSpeech) {
    try {
      const info = await MotMinuteSpeech.getAudioInfo(uri);
      if (info.durationSec > 0) return info.durationSec;
    } catch {
      throw new ImportError('Ce fichier audio est illisible ou endommagé. Exportez-le à nouveau en .m4a, .mp3 ou .wav.');
    }
  }
  const player = createAudioPlayer({ uri });
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 10000);
      const check = () => {
        if (player.isLoaded && player.duration > 0) {
          clearTimeout(timer);
          sub.remove();
          resolve(player.duration);
        }
      };
      const sub = player.addListener('playbackStatusUpdate', check);
      check();
    });
    return duration;
  } catch {
    throw new ImportError('Ce fichier audio est illisible ou endommagé. Exportez-le à nouveau en .m4a, .mp3 ou .wav.');
  } finally {
    player.remove();
  }
}

export type ImportedAudio = { id: string; ref: string; title: string; durationSec: number; originalFilename: string };

/**
 * Ouvre Fichiers, vérifie le format, garde une copie privée dans l'app et
 * mesure la durée. Renvoie null si l'utilisateur annule.
 */
export async function pickAndImportAudio(): Promise<ImportedAudio | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const ext = extensionOf(asset.name);
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ImportError(`Format « .${ext || '?'} » non pris en charge. Choisissez un fichier .m4a, .mp3 ou .wav.`);
  }
  if (asset.size === 0) throw new ImportError('Ce fichier est vide.');

  const id = `itw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ref = `${id}.${ext}`;
  const target = audioFileFor(ref);
  try {
    await new File(asset.uri).copy(target);
  } catch {
    throw new ImportError('Impossible de copier le fichier dans MotMinute. Vérifiez l’espace disponible sur l’iPhone.');
  }
  try {
    const durationSec = await probeDuration(target.uri);
    return { id, ref, title: titleFromFilename(asset.name), durationSec, originalFilename: asset.name };
  } catch (e) {
    deleteAudio(ref);
    throw e;
  } finally {
    try {
      const cached = new File(asset.uri);
      if (cached.exists) cached.delete();
    } catch {
      // le cache du sélecteur sera vidé par iOS
    }
  }
}
