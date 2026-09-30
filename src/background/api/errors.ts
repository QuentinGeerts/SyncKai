import type { AniListErrorCode } from '../../shared/anilist.types';

/** Codes d'erreur communs aux API des services de suivi (AniList, MyAnimeList) */
export type ApiErrorCode = AniListErrorCode;

/** Erreur typée levée par les clients d'API ; convertie en résultat affichable par les handlers. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}
