/**
 * Accès aux données locales (SQLite). Tout reste sur l'iPhone.
 *
 * L'interface `SqlDb` correspond au sous-ensemble d'expo-sqlite utilisé ; les
 * tests branchent un adaptateur `node:sqlite` sur un vrai fichier pour vérifier
 * la persistance après « redémarrage » (fermeture puis réouverture).
 */

export type SqlParam = string | number | null;

export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlParam[]): Promise<T | null>;
}

export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'error' | 'interrupted';
export type InterviewSource = 'demo' | 'user';

export type Interview = {
  id: string;
  title: string;
  durationSec: number;
  createdAt: number;
  /** Nom du fichier dans le dossier privé de l'app, ou `demo:<nom>` pour l'audio intégré. */
  audioRef: string;
  originalFilename: string | null;
  source: InterviewSource;
  status: TranscriptionStatus;
  progress: number;
  errorMessage: string | null;
  transcribedAt: number | null;
  engine: string | null;
  segmentCount: number;
};

export type Segment = {
  id: number;
  interviewId: string;
  idx: number;
  start: number;
  end: number;
  /** Texte affiché (éventuellement corrigé). */
  text: string;
  /** Texte produit par le moteur, conservé pour référence. */
  originalText: string;
  edited: boolean;
};

export type SavedQuote = {
  id: number;
  interviewId: string;
  segmentId: number | null;
  text: string;
  start: number;
  end: number;
  interviewTitle: string;
  createdAt: number;
};

export type NewSegment = { start: number; end: number; text: string };

const SCHEMA_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      duration_sec REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      audio_ref TEXT NOT NULL,
      original_filename TEXT,
      source TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0,
      error_message TEXT,
      transcribed_at INTEGER,
      engine TEXT
    );
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      idx INTEGER NOT NULL,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      text TEXT NOT NULL,
      original_text TEXT NOT NULL,
      edited INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_segments_interview ON segments(interview_id, idx);
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
      segment_id INTEGER,
      text TEXT NOT NULL,
      start_sec REAL NOT NULL,
      end_sec REAL NOT NULL,
      interview_title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    -- Journal du quota : une ligne par transcription TERMINÉE (jamais supprimée,
    -- même si l'interview l'est, pour que le quota soit cumulatif).
    CREATE TABLE IF NOT EXISTS transcription_usage (
      interview_id TEXT PRIMARY KEY NOT NULL,
      seconds REAL NOT NULL,
      completed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
};

type InterviewRow = {
  id: string;
  title: string;
  duration_sec: number;
  created_at: number;
  audio_ref: string;
  original_filename: string | null;
  source: InterviewSource;
  status: TranscriptionStatus;
  progress: number;
  error_message: string | null;
  transcribed_at: number | null;
  engine: string | null;
  segment_count: number;
};

type SegmentRow = {
  id: number;
  interview_id: string;
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string;
  original_text: string;
  edited: number;
};

type QuoteRow = {
  id: number;
  interview_id: string;
  segment_id: number | null;
  text: string;
  start_sec: number;
  end_sec: number;
  interview_title: string;
  created_at: number;
};

const toInterview = (r: InterviewRow): Interview => ({
  id: r.id,
  title: r.title,
  durationSec: r.duration_sec,
  createdAt: r.created_at,
  audioRef: r.audio_ref,
  originalFilename: r.original_filename,
  source: r.source,
  status: r.status,
  progress: r.progress,
  errorMessage: r.error_message,
  transcribedAt: r.transcribed_at,
  engine: r.engine,
  segmentCount: r.segment_count ?? 0,
});

const toSegment = (r: SegmentRow): Segment => ({
  id: r.id,
  interviewId: r.interview_id,
  idx: r.idx,
  start: r.start_sec,
  end: r.end_sec,
  text: r.text,
  originalText: r.original_text,
  edited: r.edited === 1,
});

const toQuote = (r: QuoteRow): SavedQuote => ({
  id: r.id,
  interviewId: r.interview_id,
  segmentId: r.segment_id,
  text: r.text,
  start: r.start_sec,
  end: r.end_sec,
  interviewTitle: r.interview_title,
  createdAt: r.created_at,
});

const INTERVIEW_SELECT = `
  SELECT i.*, (SELECT COUNT(*) FROM segments s WHERE s.interview_id = i.id) AS segment_count
  FROM interviews i`;

export class Repository {
  constructor(private readonly db: SqlDb) {}

  async migrate(): Promise<void> {
    await this.db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    let version = row?.user_version ?? 0;
    while (version < SCHEMA_VERSION) {
      version++;
      await this.db.execAsync(MIGRATIONS[version]);
      await this.db.execAsync(`PRAGMA user_version = ${version}`);
    }
  }

  // ---------- Interviews ----------

  async listInterviews(): Promise<Interview[]> {
    const rows = await this.db.getAllAsync<InterviewRow>(`${INTERVIEW_SELECT} ORDER BY i.created_at DESC`, []);
    return rows.map(toInterview);
  }

  async getInterview(id: string): Promise<Interview | null> {
    const row = await this.db.getFirstAsync<InterviewRow>(`${INTERVIEW_SELECT} WHERE i.id = ?`, [id]);
    return row ? toInterview(row) : null;
  }

  async insertInterview(i: {
    id: string;
    title: string;
    durationSec: number;
    createdAt: number;
    audioRef: string;
    originalFilename: string | null;
    source: InterviewSource;
    status?: TranscriptionStatus;
  }): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO interviews (id, title, duration_sec, created_at, audio_ref, original_filename, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [i.id, i.title, i.durationSec, i.createdAt, i.audioRef, i.originalFilename, i.source, i.status ?? 'pending'],
    );
  }

  async renameInterview(id: string, title: string): Promise<void> {
    const clean = title.trim();
    if (!clean) throw new Error('Le titre ne peut pas être vide.');
    await this.db.runAsync('UPDATE interviews SET title = ? WHERE id = ?', [clean, id]);
  }

  /** Supprime l'interview, ses blocs et ses citations. Le journal du quota est conservé. */
  async deleteInterview(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM quotes WHERE interview_id = ?', [id]);
    await this.db.runAsync('DELETE FROM segments WHERE interview_id = ?', [id]);
    await this.db.runAsync('DELETE FROM interviews WHERE id = ?', [id]);
  }

  async setStatus(id: string, status: TranscriptionStatus, errorMessage: string | null = null): Promise<void> {
    await this.db.runAsync('UPDATE interviews SET status = ?, error_message = ?, progress = CASE WHEN ? = \'processing\' THEN 0 ELSE progress END WHERE id = ?', [
      status,
      errorMessage,
      status,
      id,
    ]);
  }

  async setProgress(id: string, progress: number): Promise<void> {
    await this.db.runAsync('UPDATE interviews SET progress = ? WHERE id = ?', [Math.max(0, Math.min(1, progress)), id]);
  }

  /**
   * Termine une transcription : remplace les blocs, passe l'état à « done » et
   * inscrit la durée au journal du quota (une seule fois par interview, et
   * jamais pour la démo).
   */
  async completeTranscription(id: string, segments: NewSegment[], engine: string, now = Date.now()): Promise<void> {
    const interview = await this.getInterview(id);
    if (!interview) throw new Error('Interview introuvable.');
    await this.db.execAsync('BEGIN');
    try {
      await this.db.runAsync('DELETE FROM segments WHERE interview_id = ?', [id]);
      let idx = 0;
      for (const s of segments) {
        await this.db.runAsync(
          'INSERT INTO segments (interview_id, idx, start_sec, end_sec, text, original_text, edited) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [id, idx++, s.start, s.end, s.text, s.text],
        );
      }
      await this.db.runAsync(
        "UPDATE interviews SET status = 'done', progress = 1, error_message = NULL, transcribed_at = ?, engine = ? WHERE id = ?",
        [now, engine, id],
      );
      if (interview.source === 'user') {
        await this.db.runAsync('INSERT OR IGNORE INTO transcription_usage (interview_id, seconds, completed_at) VALUES (?, ?, ?)', [
          id,
          interview.durationSec,
          now,
        ]);
      }
      await this.db.execAsync('COMMIT');
    } catch (e) {
      await this.db.execAsync('ROLLBACK');
      throw e;
    }
  }

  /** Au démarrage : un traitement resté « en cours » a été interrompu (app fermée, plantage). */
  async recoverInterrupted(): Promise<number> {
    const res = await this.db.runAsync(
      "UPDATE interviews SET status = 'interrupted', error_message = 'Le traitement a été interrompu (application fermée). L’audio est conservé.' WHERE status = 'processing'",
      [],
    );
    return res.changes;
  }

  // ---------- Quota ----------

  async usedTranscriptionSeconds(): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number | null }>('SELECT SUM(seconds) AS total FROM transcription_usage', []);
    return row?.total ?? 0;
  }

  // ---------- Segments ----------

  async listSegments(interviewId: string): Promise<Segment[]> {
    const rows = await this.db.getAllAsync<SegmentRow>('SELECT * FROM segments WHERE interview_id = ? ORDER BY idx', [interviewId]);
    return rows.map(toSegment);
  }

  async getSegment(id: number): Promise<Segment | null> {
    const row = await this.db.getFirstAsync<SegmentRow>('SELECT * FROM segments WHERE id = ?', [id]);
    return row ? toSegment(row) : null;
  }

  /** Corrige le texte d'un bloc. Les repères audio (début/fin) ne sont jamais modifiés. */
  async updateSegmentText(id: number, text: string): Promise<void> {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Le texte du bloc ne peut pas être vide.');
    await this.db.runAsync('UPDATE segments SET text = ?, edited = CASE WHEN original_text = ? THEN 0 ELSE 1 END WHERE id = ?', [
      clean,
      clean,
      id,
    ]);
  }

  /** Tous les blocs transcrits de la bibliothèque, pour la recherche. */
  async allSearchableSegments(): Promise<(Segment & { interviewTitle: string })[]> {
    const rows = await this.db.getAllAsync<SegmentRow & { title: string }>(
      `SELECT s.*, i.title FROM segments s JOIN interviews i ON i.id = s.interview_id
       WHERE i.status = 'done' ORDER BY i.created_at DESC, s.idx`,
      [],
    );
    return rows.map((r) => ({ ...toSegment(r), interviewTitle: r.title }));
  }

  // ---------- Citations ----------

  async saveQuote(q: { interviewId: string; segmentId: number | null; text: string; start: number; end: number; interviewTitle: string }, now = Date.now()): Promise<number> {
    const res = await this.db.runAsync(
      'INSERT INTO quotes (interview_id, segment_id, text, start_sec, end_sec, interview_title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [q.interviewId, q.segmentId, q.text, q.start, q.end, q.interviewTitle, now],
    );
    return res.lastInsertRowId;
  }

  async listQuotes(): Promise<SavedQuote[]> {
    const rows = await this.db.getAllAsync<QuoteRow>(
      `SELECT q.id, q.interview_id, q.segment_id, q.text, q.start_sec, q.end_sec, q.created_at,
              COALESCE(i.title, q.interview_title) AS interview_title
       FROM quotes q LEFT JOIN interviews i ON i.id = q.interview_id ORDER BY q.created_at DESC, q.id DESC`,
      [],
    );
    return rows.map(toQuote);
  }

  async deleteQuote(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM quotes WHERE id = ?', [id]);
  }

  // ---------- Réglages ----------

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }
}
