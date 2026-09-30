export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastContent {
  tone: ToastTone;
  title: string;
  message?: string;
  /** Bouton d'action (ex : "Réessayer") */
  action?: { label: string; onClick: () => void };
}

export interface ToastHandle {
  /** Remplace le contenu ; `autoHideMs` programme la fermeture (sinon le toast reste affiché) */
  update(content: ToastContent, autoHideMs?: number): void;
  dismiss(): void;
}

const ICONS: Record<ToastTone, string> = { info: '', success: '✓', warning: '!', error: '✕' };

// Styles isolés dans un Shadow DOM : ni la page ne les écrase, ni ils ne fuient dans la page
const STYLES = `
  :host { all: initial; }
  .toast {
    position: fixed; right: 24px; bottom: 96px; z-index: 2147483647;
    display: flex; align-items: flex-start; gap: 10px;
    width: max-content; max-width: 320px; box-sizing: border-box; padding: 12px 14px;
    border-radius: 12px; border: 1px solid #3f3f46; background: rgba(24, 24, 27, 0.96);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    color: #f4f4f5; font: 500 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    opacity: 0; transform: translateY(8px); transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .toast.visible { opacity: 1; transform: none; }
  .icon {
    flex: none; width: 20px; height: 20px; box-sizing: border-box; border-radius: 999px;
    display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #09090b;
  }
  .success .icon { background: #34d399; }
  .warning .icon { background: #fbbf24; }
  .error .icon { background: #f87171; }
  .info .icon { border: 2px solid #52525b; border-top-color: #38bdf8; animation: spin 0.8s linear infinite; }
  .body { min-width: 0; }
  .brand { margin-bottom: 2px; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #a1a1aa; }
  .title { font-weight: 600; overflow-wrap: anywhere; }
  .message { margin-top: 2px; font-weight: 400; color: #a1a1aa; overflow-wrap: anywhere; }
  .action {
    margin-top: 8px; padding: 4px 10px; border: 1px solid #52525b; border-radius: 6px;
    background: #27272a; color: #f4f4f5; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .action:hover { background: #3f3f46; }
  .action:focus-visible, .close:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
  .close {
    flex: none; margin: -4px -6px 0 4px; padding: 2px 6px; border: 0; border-radius: 6px;
    background: none; color: #71717a; font: inherit; font-size: 14px; cursor: pointer;
  }
  .close:hover { color: #f4f4f5; background: #27272a; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .toast { transition: none; }
    .info .icon { animation: none; }
  }
`;

let current: ToastHandle | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * Affiche un toast unique (le précédent est remplacé).
 * En plein écran, seul l'élément plein écran est visible : le toast y est donc déplacé.
 */
export function showToast(content: ToastContent, autoHideMs?: number): ToastHandle {
  current?.dismiss();

  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLES;

  const toast = el('div', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const icon = el('div', 'icon');
  const body = el('div', 'body');
  const brand = el('div', 'brand', 'SyncKai');
  const title = el('div', 'title');
  const message = el('div', 'message');
  const action = el('button', 'action');
  action.type = 'button';
  const close = el('button', 'close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer');

  body.append(brand, title, message, action);
  toast.append(icon, body, close);
  shadow.append(style, toast);

  const controller = new AbortController();
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const attach = (): void => {
    (document.fullscreenElement ?? document.body).append(host);
  };

  const handle: ToastHandle = {
    update(next, hideAfterMs) {
      toast.className = `toast visible ${next.tone}`;
      icon.textContent = ICONS[next.tone];
      title.textContent = next.title;
      message.textContent = next.message ?? '';
      message.hidden = !next.message;
      action.hidden = !next.action;
      action.textContent = next.action?.label ?? '';
      action.onclick = next.action ? () => next.action?.onClick() : null;
      clearTimeout(hideTimer);
      if (hideAfterMs !== undefined) hideTimer = setTimeout(() => handle.dismiss(), hideAfterMs);
    },
    dismiss() {
      if (controller.signal.aborted) return;
      controller.abort();
      clearTimeout(hideTimer);
      toast.classList.remove('visible');
      setTimeout(() => host.remove(), 200); // Laisse la transition de sortie se terminer
      if (current === handle) current = null;
    },
  };

  close.addEventListener('click', () => handle.dismiss(), { signal: controller.signal });
  document.addEventListener('fullscreenchange', attach, { signal: controller.signal });

  attach();
  handle.update(content, autoHideMs);
  // Classe "visible" retirée puis remise à la frame suivante pour déclencher l'animation d'entrée
  toast.classList.remove('visible');
  requestAnimationFrame(() => toast.classList.add('visible'));

  current = handle;
  return handle;
}
