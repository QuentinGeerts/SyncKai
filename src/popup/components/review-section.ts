import type { PendingReview } from '../../shared/review.types';
import { h } from '../../ui/dom';
import { createReviewCard, type ReviewActions, type ReviewCard } from './review-card';

export interface ReviewSection {
  readonly element: HTMLElement;
  update(reviews: PendingReview[]): void;
}

/**
 * Section "À vérifier" : réconcilie les cartes par clé de saison au lieu de tout redessiner,
 * pour conserver l'état local de chaque carte (saisie en cours, résultat affiché).
 */
export function createReviewSection(actions: ReviewActions): ReviewSection {
  const cards = new Map<string, ReviewCard>();
  const title = h('h2', { class: 'text-[11px] font-medium uppercase tracking-wide text-amber-400' });
  const list = h('div', { class: 'flex flex-col gap-2' });
  const element = h('section', { class: 'flex flex-col gap-2' }, title, list);
  let pendingCount = 0;

  function refreshChrome(): void {
    title.textContent = `À vérifier (${pendingCount})`;
    element.hidden = cards.size === 0;
  }

  return {
    element,
    update(reviews) {
      const keys = new Set(reviews.map((r) => r.key));
      pendingCount = reviews.length;

      // Cartes disparues du stockage (ignorées, résolues ailleurs) — sauf celles qui affichent un résultat
      for (const [key, card] of cards) {
        if (!keys.has(key) && !card.isBusy()) {
          card.element.remove();
          cards.delete(key);
        }
      }

      // Nouvelles cartes en tête (reviews est trié du plus récent au plus ancien)
      for (const review of [...reviews].reverse()) {
        const existing = cards.get(review.key);
        if (existing) {
          existing.update(review);
          continue;
        }
        const card = createReviewCard(review, actions, () => {
          cards.delete(review.key);
          refreshChrome();
        });
        cards.set(review.key, card);
        list.prepend(card.element);
      }

      refreshChrome();
    },
  };
}
