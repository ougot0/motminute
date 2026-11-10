/**
 * Aperçu web : même interface que la base SQLite de l'iPhone, mais en mémoire,
 * sauvegardée dans le navigateur (localStorage) quand c'est possible.
 * Utilisé uniquement par la version web (Metro choisit ce fichier pour le web).
 */
import { seedDemo } from './demo';
import {
  Repository,
  type Interview,
  type InterviewSource,
  type NewSegment,
  type SavedQuote,
  type Segment,
  type SqlDb,
  type TranscriptionStatus,
} from './repository';

type Store = {
  interviews: Omit<Interview, 'segmentCount'>[];
  segments: Segment[];
  quotes: SavedQuote[];
  usage: Record<string, number>;
  kv: Record<string, string>;
  seq: number;
};

const KEY = 'motminute-apercu-web-v1';
const unused: SqlDb = {
  execAsync: async () => undefined,
  runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
  getAllAsync: async () => [],
  getFirstAsync: async () => null,
};

function load(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // stockage indisponible (navigation privée, cadre) : on repart de zéro
  }
  return { interviews: [], segments: [], quotes: [], usage: {}, kv: {}, seq: 1 };
}

export class WebRepository extends Repository {
  private s: Store = load();

  constructor() {
    super(unused);
  }

  private save() {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(this.s));
    } catch {
      // pas de persistance possible : l'aperçu fonctionne quand même
    }
  }

  private withCount(i: Omit<Interview, 'segmentCount'>): Interview {
    return { ...i, segmentCount: this.s.segments.filter((x) => x.interviewId === i.id).length };
  }

  async migrate() {}

  async listInterviews() {
    return [...this.s.interviews].sort((a, b) => b.createdAt - a.createdAt).map((i) => this.withCount(i));
  }

  async getInterview(id: string) {
    const i = this.s.interviews.find((x) => x.id === id);
    return i ? this.withCount(i) : null;
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
  }) {
    this.s.interviews.push({
      ...i,
      status: i.status ?? 'pending',
      progress: 0,
      errorMessage: null,
      transcribedAt: null,
      engine: null,
    });
    this.save();
  }

  async renameInterview(id: string, title: string) {
    const clean = title.trim();
    if (!clean) throw new Error('Le titre ne peut pas être vide.');
    const i = this.s.interviews.find((x) => x.id === id);
    if (i) i.title = clean;
    this.save();
  }

  async deleteInterview(id: string) {
    this.s.quotes = this.s.quotes.filter((q) => q.interviewId !== id);
    this.s.segments = this.s.segments.filter((x) => x.interviewId !== id);
    this.s.interviews = this.s.interviews.filter((x) => x.id !== id);
    this.save();
  }

  async setStatus(id: string, status: TranscriptionStatus, errorMessage: string | null = null) {
    const i = this.s.interviews.find((x) => x.id === id);
    if (i) Object.assign(i, { status, errorMessage, progress: status === 'processing' ? 0 : i.progress });
    this.save();
  }

  async setProgress(id: string, progress: number) {
    const i = this.s.interviews.find((x) => x.id === id);
    if (i) i.progress = Math.max(0, Math.min(1, progress));
  }

  async completeTranscription(id: string, segments: NewSegment[], engine: string, now = Date.now()) {
    const i = this.s.interviews.find((x) => x.id === id);
    if (!i) throw new Error('Interview introuvable.');
    this.s.segments = this.s.segments.filter((x) => x.interviewId !== id);
    segments.forEach((seg, idx) =>
      this.s.segments.push({ id: this.s.seq++, interviewId: id, idx, start: seg.start, end: seg.end, text: seg.text, originalText: seg.text, edited: false }),
    );
    Object.assign(i, { status: 'done', progress: 1, errorMessage: null, transcribedAt: now, engine });
    if (i.source === 'user' && this.s.usage[id] === undefined) this.s.usage[id] = i.durationSec;
    this.save();
  }

  async recoverInterrupted() {
    let n = 0;
    for (const i of this.s.interviews) {
      if (i.status === 'processing') {
        i.status = 'interrupted';
        i.errorMessage = 'Le traitement a été interrompu (application fermée). L’audio est conservé.';
        n++;
      }
    }
    this.save();
    return n;
  }

  async usedTranscriptionSeconds() {
    return Object.values(this.s.usage).reduce((a, b) => a + b, 0);
  }

  async listSegments(interviewId: string) {
    return this.s.segments.filter((x) => x.interviewId === interviewId).sort((a, b) => a.idx - b.idx);
  }

  async getSegment(id: number) {
    return this.s.segments.find((x) => x.id === id) ?? null;
  }

  async updateSegmentText(id: number, text: string) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Le texte du bloc ne peut pas être vide.');
    const seg = this.s.segments.find((x) => x.id === id);
    if (seg) Object.assign(seg, { text: clean, edited: clean !== seg.originalText });
    this.save();
  }

  async allSearchableSegments() {
    const done = new Map(this.s.interviews.filter((i) => i.status === 'done').map((i) => [i.id, i]));
    return this.s.segments
      .filter((x) => done.has(x.interviewId))
      .sort((a, b) => done.get(b.interviewId)!.createdAt - done.get(a.interviewId)!.createdAt || a.idx - b.idx)
      .map((x) => ({ ...x, interviewTitle: done.get(x.interviewId)!.title }));
  }

  async saveQuote(q: { interviewId: string; segmentId: number | null; text: string; start: number; end: number; interviewTitle: string }, now = Date.now()) {
    const id = this.s.seq++;
    this.s.quotes.push({ id, ...q, createdAt: now });
    this.save();
    return id;
  }

  async listQuotes() {
    return [...this.s.quotes]
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
      .map((q) => ({ ...q, interviewTitle: this.s.interviews.find((i) => i.id === q.interviewId)?.title ?? q.interviewTitle }));
  }

  async deleteQuote(id: number) {
    this.s.quotes = this.s.quotes.filter((q) => q.id !== id);
    this.save();
  }

  async getSetting(key: string) {
    return this.s.kv[key] ?? null;
  }

  async setSetting(key: string, value: string) {
    this.s.kv[key] = value;
    this.save();
  }
}

let opening: Promise<Repository> | null = null;

export function openRepository(): Promise<Repository> {
  if (!opening) {
    opening = (async () => {
      const repo = new WebRepository();
      await seedDemo(repo);
      await repo.recoverInterrupted();
      return repo;
    })();
  }
  return opening;
}
