/** Clé de stockage du token AniList dans chrome.storage.local */
export const ANILIST_TOKEN_KEY = 'anilistToken';

export interface AniListToken {
  accessToken: string;
  /** Timestamp (ms) d'expiration du token */
  expiresAt: number;
}

export type AuthErrorCode = 'USER_CANCELLED' | 'AUTH_FLOW_FAILED' | 'ACCESS_DENIED' | 'INVALID_RESPONSE' | 'UNKNOWN';

export type AuthResult =
  | { success: true }
  | { success: false; code: AuthErrorCode; message: string };

export type RuntimeMessage = { type: 'LOGIN_ANILIST' };

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'LOGIN_ANILIST';
}

export function isAniListToken(value: unknown): value is AniListToken {
  if (typeof value !== 'object' || value === null) return false;
  const token = value as Partial<AniListToken>;
  return typeof token.accessToken === 'string' && typeof token.expiresAt === 'number';
}
