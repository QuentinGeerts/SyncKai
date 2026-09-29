/** Vrai si la valeur est un objet non nul (base des type guards sur les données externes). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
