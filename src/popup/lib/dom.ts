export type Child = Node | string | null | undefined | false;

/** Retire les enfants "vides" (null, undefined, false) pour replaceChildren / append */
export function nodes(children: Child[]): (Node | string)[] {
  return children.filter((child): child is Node | string => child !== null && child !== undefined && child !== false);
}

type EventHandlers = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

interface ElementProps {
  class?: string;
  attrs?: Record<string, string>;
  on?: EventHandlers;
}

/**
 * Crée un élément DOM. Les chaînes enfants sont insérées comme nœuds texte (jamais d'innerHTML),
 * ce qui protège contre l'injection de HTML venant des API.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  for (const [name, value] of Object.entries(props.attrs ?? {})) el.setAttribute(name, value);
  for (const [type, handler] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, handler as EventListener);
  }
  el.append(...nodes(children));
  return el;
}
