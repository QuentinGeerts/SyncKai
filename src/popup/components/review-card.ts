import type { Result } from '../../shared/result';
import type { CandidateSummary, PendingReview } from '../../shared/review.types';
import { describeOutcome, type SyncFeedback } from '../../shared/sync-feedback';
import type { SyncOutcome } from '../../shared/sync.types';
import { h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';

export interface ReviewActions {
  search(query: string): Promise<Result<CandidateSummary[], string>>;
  confirm(key: string, mediaId: number, progress: number): Promise<SyncOutcome>;
  dismiss(key: string): Promise<void>;
}

export interface ReviewCard {
  readonly element: HTMLElement;
  /** Nouvelle donnée pour la même saison (nouvel épisode, correction rouverte) */
  update(review: PendingReview): void;
  /** Vrai pendant l'envoi ou l'affichage du résultat : la carte ne doit pas disparaître */
  isBusy(): boolean;
}

const RESULT_VISIBLE_MS = 5_000;

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV court',
  ONA: 'ONA',
  OVA: 'OVA',
  MOVIE: 'Film',
  SPECIAL: 'Spécial',
};

const TONE_CLASSES: Record<SyncFeedback['tone'], string> = {
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  info: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  warning: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  error: 'bg-red-500/10 text-red-300 ring-red-500/30',
};

function episodeLabel({ episode }: PendingReview): string {
  const parts = [
    episode.seasonNumber !== null ? `S${episode.seasonNumber}` : null,
    episode.seasonEpisodeNumber !== null ? `E${episode.seasonEpisodeNumber}` : null,
  ].filter((p): p is string => p !== null);
  const displayed = episode.displayedEpisodeNumber;
  if (displayed !== null && displayed !== episode.seasonEpisodeNumber) parts.push(`(affiché E${displayed})`);
  return parts.join(' · ') || 'Épisode';
}

function candidateMeta(c: CandidateSummary): string {
  return [c.format ? (FORMAT_LABELS[c.format] ?? c.format) : null, c.episodes !== null ? `${c.episodes} ép.` : null, c.year]
    .filter((p) => p !== null)
    .join(' · ');
}

function defaultProgress(review: PendingReview): string {
  const value = review.suggestion?.progress ?? review.episode.seasonEpisodeNumber ?? review.episode.displayedEpisodeNumber;
  return value !== null ? String(value) : '';
}

/**
 * Carte de vérification d'une saison. Elle gère son propre état local (sélection, saisie, recherche)
 * et ne se redessine que sur ses propres actions : taper un numéro ne fait pas perdre le focus.
 */
export function createReviewCard(initial: PendingReview, actions: ReviewActions, onClose: () => void): ReviewCard {
  let review = initial;
  let selected: CandidateSummary | null = null;
  let progressText = '';
  let searchQuery = '';
  let searchResults: CandidateSummary[] | null = null;
  let isSearching = false;
  let phase: 'editing' | 'submitting' | 'done' = 'editing';
  let feedback: SyncFeedback | null = null;
  let note: string | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const element = h('article', { class: 'flex flex-col gap-2.5 rounded-xl bg-zinc-900 p-3 ring-1 ring-amber-500/30' });

  function reset(next: PendingReview): void {
    review = next;
    const suggestedId = next.suggestion?.mediaId;
    selected = next.candidates.find((c) => c.id === suggestedId) ?? next.candidates[0] ?? null;
    progressText = defaultProgress(next);
    searchQuery = '';
    searchResults = null;
    phase = 'editing';
    feedback = null;
    note = null;
  }

  function renderCandidate(candidate: CandidateSummary): HTMLElement {
    const isSelected = candidate.id === selected?.id;
    const cover = candidate.coverUrl
      ? h('img', { class: 'h-10 w-7 shrink-0 rounded bg-zinc-800 object-cover', attrs: { src: candidate.coverUrl, alt: '', referrerpolicy: 'no-referrer' } })
      : h('div', { class: 'h-10 w-7 shrink-0 rounded bg-zinc-800' });

    return h(
      'button',
      {
        class: `flex w-full cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left ring-1 transition focus:outline-none focus-visible:ring-sky-400 ${
          isSelected ? 'bg-sky-500/10 ring-sky-500/50' : 'ring-transparent hover:bg-zinc-800'
        }`,
        attrs: { type: 'button', 'aria-pressed': String(isSelected) },
        on: {
          click: () => {
            selected = candidate;
            render();
          },
        },
      },
      cover,
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('p', { class: 'truncate text-xs font-medium text-zinc-100', attrs: { title: candidate.title } }, candidate.title),
        h('p', { class: 'text-[10px] text-zinc-500' }, candidateMeta(candidate) || '—'),
      ),
      isSelected && icon('check', 'h-3.5 w-3.5 text-sky-400'),
    );
  }

  function renderSearch(): HTMLElement {
    const input = h('input', {
      class: 'min-w-0 flex-1 rounded-md bg-zinc-950 px-2 py-1 text-xs text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-sky-500',
      attrs: { type: 'search', placeholder: 'Autre fiche…', 'aria-label': 'Rechercher une fiche AniList', maxlength: '100' },
      on: { input: () => (searchQuery = input.value) },
    });
    input.value = searchQuery;

    return h(
      'form',
      {
        class: 'flex gap-1.5',
        on: {
          submit: (e) => {
            e.preventDefault();
            void runSearch();
          },
        },
      },
      input,
      h(
        'button',
        {
          class: 'flex shrink-0 cursor-pointer items-center rounded-md px-2 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-100 disabled:opacity-50',
          attrs: { type: 'submit', 'aria-label': 'Rechercher', ...(isSearching ? { disabled: '' } : {}) },
        },
        isSearching ? icon('spinner', 'h-3.5 w-3.5 animate-spin') : icon('search', 'h-3.5 w-3.5'),
      ),
    );
  }

  function renderProgressField(): HTMLElement {
    const input = h('input', {
      class: 'w-16 rounded-md bg-zinc-950 px-2 py-1 text-right text-xs text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-sky-500',
      attrs: { type: 'number', min: '1', step: '1', inputmode: 'numeric', 'aria-label': 'Épisode AniList' },
      on: { input: () => (progressText = input.value) },
    });
    input.value = progressText;
    const total = selected?.episodes;

    return h(
      'label',
      { class: 'flex items-center justify-between gap-2 text-xs text-zinc-400' },
      'Épisode AniList',
      h('span', { class: 'flex items-center gap-1.5' }, input, h('span', { class: 'text-[10px] text-zinc-600' }, total ? `/ ${total}` : '')),
    );
  }

  function renderFeedback(): HTMLElement | null {
    if (!feedback) return null;
    return h(
      'div',
      { class: `rounded-lg px-2.5 py-2 text-[11px] ring-1 ${TONE_CLASSES[feedback.tone]}`, attrs: { role: 'status' } },
      h('p', { class: 'font-medium' }, feedback.title),
      feedback.message && h('p', { class: 'opacity-80' }, feedback.message),
      note && h('p', { class: 'mt-1 font-medium text-amber-300' }, note),
    );
  }

  function render(): void {
    const header = h(
      'div',
      { class: 'min-w-0' },
      h('p', { class: 'truncate text-sm font-semibold text-zinc-100', attrs: { title: review.episode.animeTitle } }, review.episode.animeTitle),
      h('p', { class: 'text-[11px] text-zinc-500' }, episodeLabel(review)),
    );

    if (phase === 'done') {
      element.replaceChildren(...nodes([
        header,
        renderFeedback(),
        h(
          'button',
          { class: 'self-end cursor-pointer text-[11px] font-medium text-zinc-400 hover:text-zinc-100', attrs: { type: 'button' }, on: { click: close } },
          'Fermer',
        ),
      ]));
      return;
    }

    const isSubmitting = phase === 'submitting';
    const listItems = review.candidates.map(renderCandidate);
    const searchItems = searchResults?.map(renderCandidate) ?? [];

    element.replaceChildren(...nodes([
      header,
      h('p', { class: 'flex items-start gap-1.5 text-[11px] text-amber-300' }, icon('alert', 'mt-px h-3 w-3'), h('span', {}, review.reason)),
      h(
        'div',
        { class: 'flex max-h-56 flex-col gap-1 overflow-y-auto pr-0.5' },
        ...(listItems.length > 0 ? listItems : [h('p', { class: 'text-[11px] text-zinc-500' }, 'Aucune fiche proposée : utilise la recherche.')]),
        searchResults && h('p', { class: 'mt-1 text-[10px] uppercase tracking-wide text-zinc-500' }, `Résultats (${searchResults.length})`),
        ...searchItems,
      ),
      renderSearch(),
      renderProgressField(),
      renderFeedback(),
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h(
          'button',
          {
            class: 'cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50',
            attrs: { type: 'button', ...(isSubmitting ? { disabled: '' } : {}) },
            on: { click: () => void actions.dismiss(review.key) },
          },
          'Ignorer',
        ),
        h(
          'button',
          {
            class:
              'flex cursor-pointer items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50',
            attrs: { type: 'button', ...(isSubmitting || !selected ? { disabled: '' } : {}) },
            on: { click: () => void submit() },
          },
          isSubmitting && icon('spinner', 'h-3.5 w-3.5 animate-spin'),
          isSubmitting ? 'Synchronisation…' : 'Confirmer',
        ),
      ),
    ]));
  }

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim();
    if (!query || isSearching) return;
    isSearching = true;
    render();
    const result = await actions.search(query);
    isSearching = false;
    searchResults = result.ok ? result.data.filter((c) => !review.candidates.some((r) => r.id === c.id)) : [];
    feedback = result.ok ? null : { tone: 'error', title: 'Recherche impossible', message: result.message };
    render();
  }

  async function submit(): Promise<void> {
    if (!selected || phase !== 'editing') return;
    const progress = Number(progressText);
    const max = selected.episodes;
    if (!Number.isInteger(progress) || progress < 1 || (max !== null && progress > max)) {
      feedback = { tone: 'error', title: 'Épisode invalide', message: max !== null ? `Entre 1 et ${max} pour cette fiche.` : 'Entre un numéro supérieur ou égal à 1.' };
      render();
      return;
    }

    const chosen = selected;
    phase = 'submitting';
    feedback = null;
    render();

    const outcome = await actions.confirm(review.key, chosen.id, progress);
    feedback = describeOutcome(outcome);
    const isApplied = outcome.status === 'updated' || outcome.status === 'up-to-date' || outcome.status === 'skipped';
    if (!isApplied) {
      phase = 'editing';
      render();
      return;
    }

    phase = 'done';
    // Correction vers une autre fiche : la progression écrite sur l'ancienne n'est pas annulée
    const previous = review.previous;
    note = previous && previous.mediaId !== chosen.id
      ? `Pense à corriger « ${previous.title} » sur AniList (épisode ${previous.progress} y a été enregistré).`
      : null;
    render();
    // Avec une note à lire, la carte reste affichée jusqu'au clic sur "Fermer"
    if (!note) closeTimer = setTimeout(close, RESULT_VISIBLE_MS);
  }

  function close(): void {
    clearTimeout(closeTimer);
    element.remove();
    onClose();
  }

  reset(initial);
  render();

  return {
    element,
    update(next) {
      if (phase !== 'editing' || next.createdAt === review.createdAt) return;
      reset(next);
      render();
    },
    isBusy: () => phase !== 'editing',
  };
}
