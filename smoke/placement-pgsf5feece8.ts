// Placement smoke pgsf5feece8
export const MAX_DELAY_MS = 30_000;

export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
}

export function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500;
}
