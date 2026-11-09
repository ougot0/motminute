/** Version gratuite : 60 minutes cumulées de transcription TERMINÉE. */
export const FREE_QUOTA_SECONDS = 60 * 60;

export type QuotaSnapshot = {
  usedSeconds: number;
  limitSeconds: number | null;
  remainingSeconds: number | null;
  isPro: boolean;
};

export function quotaSnapshot(usedSeconds: number, isPro: boolean): QuotaSnapshot {
  if (isPro) return { usedSeconds, limitSeconds: null, remainingSeconds: null, isPro };
  return {
    usedSeconds,
    limitSeconds: FREE_QUOTA_SECONDS,
    remainingSeconds: Math.max(0, FREE_QUOTA_SECONDS - usedSeconds),
    isPro,
  };
}

export type QuotaDecision = { allowed: true } | { allowed: false; reason: 'quota'; remainingSeconds: number };

/**
 * Une nouvelle transcription est autorisée si elle tient dans le reste du quota
 * gratuit (ou si l'utilisateur est Pro). Les traitements en erreur, annulés ou
 * interrompus ne sont jamais comptés : seul `recordCompletedUsage` alimente `usedSeconds`.
 */
export function canStartTranscription(params: { usedSeconds: number; durationSeconds: number; isPro: boolean }): QuotaDecision {
  if (params.isPro) return { allowed: true };
  const remaining = Math.max(0, FREE_QUOTA_SECONDS - params.usedSeconds);
  if (params.durationSeconds <= remaining + 0.5) return { allowed: true };
  return { allowed: false, reason: 'quota', remainingSeconds: remaining };
}
