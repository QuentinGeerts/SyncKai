import { isRecord } from './guards';
import { formatRelativeTime } from './watching';

/** Clé de stockage du dernier résumé de vérification des sorties */
export const AIRING_RESULT_KEY = 'airingLastResult';

export type AiringSkipReason = 'disabled' | 'not-connected' | 'no-series';

/** Résumé d'une vérification des nouveaux épisodes (alarme horaire ou « Vérifier maintenant ») */
export interface AiringCheckResult {
  /** Horodatage de la vérification (ms) */
  checkedAt: number;
  notified: number;
  skipped: AiringSkipReason | null;
  error: string | null;
}

const SKIP_REASONS: readonly AiringSkipReason[] = ['disabled', 'not-connected', 'no-series'];

export function isAiringCheckResult(value: unknown): value is AiringCheckResult {
  return (
    isRecord(value) &&
    typeof value.checkedAt === 'number' &&
    Number.isFinite(value.checkedAt) &&
    typeof value.notified === 'number' &&
    Number.isInteger(value.notified) &&
    value.notified >= 0 &&
    (value.skipped === null || SKIP_REASONS.some((reason) => reason === value.skipped)) &&
    (value.error === null || typeof value.error === 'string')
  );
}

const SKIP_LABELS: Record<AiringSkipReason, string> = {
  disabled: 'alertes désactivées',
  'not-connected': 'aucun compte connecté',
  'no-series': 'aucune série en cours en cache — ouvre l’onglet En cours',
};

export interface AiringStatusLine {
  text: string;
  tone: 'muted' | 'danger';
}

/** Ligne d'état affichée dans Réglages › Nouveaux épisodes */
export function formatAiringStatus(result: AiringCheckResult | null, now: number): AiringStatusLine {
  if (!result) return { text: 'Jamais vérifié', tone: 'muted' };
  const prefix = `Dernière vérification : ${formatRelativeTime(result.checkedAt, now)}`;
  if (result.error !== null) return { text: `${prefix} · échec : ${result.error}`, tone: 'danger' };
  if (result.skipped !== null) return { text: `${prefix} · ${SKIP_LABELS[result.skipped]}`, tone: 'muted' };
  if (result.notified === 0) return { text: `${prefix} · aucun nouvel épisode`, tone: 'muted' };
  const s = result.notified > 1 ? 's' : '';
  return { text: `${prefix} · ${result.notified} épisode${s} notifié${s}`, tone: 'muted' };
}
