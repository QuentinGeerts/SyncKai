export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** Logger préfixé ([SyncKai:scope]) pour filtrer facilement la console de la page. */
export function createLogger(scope: string): Logger {
  const prefix = `[SyncKai:${scope}]`;
  return {
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}
