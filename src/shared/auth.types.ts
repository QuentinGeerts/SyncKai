import { isRecord } from './guards';
import type { Result } from './result';

export interface AniListToken {
  accessToken: string;
  /** Timestamp (ms) d'expiration du token */
  expiresAt: number;
}

export function isAniListToken(value: unknown): value is AniListToken {
  return isRecord(value) && typeof value.accessToken === 'string' && typeof value.expiresAt === 'number';
}

export type AuthErrorCode = 'USER_CANCELLED' | 'AUTH_FLOW_FAILED' | 'ACCESS_DENIED' | 'INVALID_RESPONSE' | 'UNKNOWN';

export type AuthResult = Result<null, AuthErrorCode>;
