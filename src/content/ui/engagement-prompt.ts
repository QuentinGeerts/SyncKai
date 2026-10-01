import type { MediaRef } from '../../shared/engagement.types';
import { sendMessage } from '../../shared/messages';
import type { SyncOutcome } from '../../shared/sync.types';
import { formatScoreLabel } from '../../ui/rating';
import { createStarRating } from '../../ui/star-rating';
import { createLogger } from '../lib/logger';
import type { EngagementPrompt } from './notification-policy';
import { ALERT_TOAST_MS, engagementResultToast, RATING_PROMPT_MS, REWATCH_PROMPT_MS } from './sync-toast';
import { showToast, type ToastHandle } from './toast';

const log = createLogger('prompt');
const SW_UNREACHABLE: SyncOutcome = { status: 'error', message: 'SyncKai injoignable. Recharge la page puis réessaie.' };

/** Classes de la feuille du Shadow DOM du toast (voir STYLES dans toast.ts) */
const STAR_CLASSES = { group: 'stars', row: 'stars-row', value: 'stars-value', star: 'star', outline: 'star-outline', fill: 'star-fill', half: 'star-half' };

async function send(run: () => Promise<SyncOutcome>): Promise<SyncOutcome> {
  try {
    return await run();
  } catch (error: unknown) {
    log.error('Service worker injoignable :', error);
    return SW_UNREACHABLE;
  }
}

/** Affiche la demande portée par une synchro (bulle unique, remplace le résultat de la synchro) */
export function showEngagementPrompt(prompt: EngagementPrompt): void {
  if (prompt.kind === 'rate') showRatingPrompt(prompt.media);
  else showRewatchPrompt(prompt.media, prompt.progress);
}

/**
 * « Ta note ? » : un clic sur une valeur envoie la note (sur 10) au service worker.
 * « Plus tard », ×, 20 s sans réponse ou bulle remplacée → note reportée (carte « À noter » du popup).
 */
function showRatingPrompt(media: MediaRef): void {
  /** Note envoyée, reportée ou relancée : la fermeture de cette bulle ne doit plus rien reporter */
  let settled = false;
  const defer = (): void => {
    if (settled) return;
    settled = true;
    sendMessage('DEFER_RATING', { media, coverUrl: null })
      .then((result) => !result.ok && log.warn('Report de la note impossible :', result.message))
      .catch((error: unknown) => log.error('Report de la note impossible :', error));
  };

  async function rate(value: number): Promise<void> {
    // Bulle « Enregistrement… » sans rappel de fermeture : un × pendant l'envoi ne reporte rien
    handle.update({ tone: 'info', title: 'Enregistrement de la note…', message: media.title }, { variant: 'bubble' });
    const outcome = await send(() => sendMessage('RATE_MEDIA', { media, score: value }));
    log.info('Résultat de la note :', outcome);
    const result = engagementResultToast(outcome, { success: `Note ${formatScoreLabel(value)} enregistrée`, failure: 'Note non enregistrée', mediaTitle: media.title });
    if (result.ok) {
      settled = true;
      handle.update(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
      return;
    }
    // Échec : « Réessayer » rouvre la notation ; sinon la note est reportée à la fermeture
    const action = {
      label: 'Réessayer',
      onClick: () => {
        settled = true;
        showRatingPrompt(media);
      },
    };
    handle.update({ ...result.content, action }, { variant: 'bubble', autoHideMs: result.autoHideMs, onDismiss: defer });
  }

  const handle: ToastHandle = showToast(
    {
      tone: 'info',
      title: `« ${media.title} » terminé !`,
      message: 'Ta note ?',
      body: createStarRating({ label: `Noter ${media.title}`, classes: STAR_CLASSES, onConfirm: (value) => void rate(value) }),
      actions: [
        {
          label: 'Plus tard',
          kind: 'ghost',
          onClick: () => {
            defer();
            handle.dismiss();
          },
        },
      ],
    },
    { variant: 'bubble', autoHideMs: RATING_PROMPT_MS, onDismiss: defer },
  );
}

/** « Tu revois … ? » : Oui → revisionnage (REPEATING) ; Non → plus de question pendant 30 jours ; sans réponse → rien */
function showRewatchPrompt(media: MediaRef, progress: number): void {
  /** `target` : bulle à mettre à jour (une erreur affichée après un × ouvre un nouveau toast, d'où le paramètre) */
  async function start(target: ToastHandle): Promise<void> {
    const saving = { tone: 'info', title: 'Revisionnage…', message: media.title } as const;
    target.update(saving, { variant: 'bubble' });
    const outcome = await send(() => sendMessage('START_REWATCH', { media, progress }));
    log.info('Résultat du revisionnage :', outcome);
    const result = engagementResultToast(outcome, { success: `Revisionnage · ép. ${progress}`, failure: 'Revisionnage non enregistré', mediaTitle: media.title });
    const action = result.ok ? undefined : { label: 'Réessayer', onClick: () => void start(showToast(saving)) };
    target.update({ ...result.content, action }, { variant: result.variant, autoHideMs: result.autoHideMs });
  }

  async function decline(): Promise<void> {
    handle.dismiss();
    try {
      const result = await sendMessage('DECLINE_REWATCH', { media });
      if (!result.ok) log.warn('Refus du revisionnage non enregistré :', result.message);
    } catch (error: unknown) {
      log.error('Service worker injoignable :', error);
      showToast({ tone: 'error', title: 'SyncKai injoignable', message: 'Recharge la page puis réessaie.' }, { autoHideMs: ALERT_TOAST_MS });
    }
  }

  const handle: ToastHandle = showToast(
    {
      tone: 'info',
      title: `Tu revois « ${media.title} » ?`,
      actions: [
        { label: 'Non', kind: 'ghost', onClick: () => void decline() },
        { label: 'Oui, revisionnage', kind: 'primary', onClick: () => void start(handle) },
      ],
    },
    { variant: 'bubble', autoHideMs: REWATCH_PROMPT_MS },
  );
}
