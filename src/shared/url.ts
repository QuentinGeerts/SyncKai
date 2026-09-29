/** N'accepte que des URLs https (optionnellement restreintes à un domaine) venant de l'API. */
export function toSafeUrl(value: string | null | undefined, allowedHost?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (allowedHost && url.hostname !== allowedHost) return null;
    return url.toString();
  } catch {
    return null;
  }
}
