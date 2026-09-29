/** Résultat d'une opération faillible, sérialisable entre le service worker et le popup. */
export type Result<T, Code extends string> =
  | { ok: true; data: T }
  | { ok: false; code: Code; message: string };
