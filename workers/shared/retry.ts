/**
 * Generic retry-with-exponential-backoff helper for transient failures.
 *
 * Used by ingestion/image workers to ride out temporary upstream blips
 * (Supabase Storage gateway timeouts, network resets, rate limits) instead
 * of failing a whole batch on a single retryable error.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Heuristic for whether an error is worth retrying. Matches gateway/timeout,
 * 5xx, rate-limit (429), and common network failures — but NOT 4xx/auth/
 * not-found/policy errors, which won't fix themselves on retry.
 */
const TRANSIENT_PATTERN =
  /\b(429|500|502|503|504)\b|timeout|timed out|gateway|temporarily|unavailable|too many requests|fetch failed|network|econnreset|econnrefused|etimedout|socket hang up|terminated/i

export function isTransientError(message: string): boolean {
  return TRANSIENT_PATTERN.test(message)
}

export interface RetryOptions {
  /** Total attempts including the first. Default 4. */
  maxAttempts?: number
  /** Delay before the first retry; doubles each subsequent retry. Default 1000ms. */
  baseDelayMs?: number
  /** Decide if a thrown error is retryable. Default: {@link isTransientError}. */
  shouldRetry?: (error: unknown) => boolean
  /** Invoked before each backoff sleep — useful for logging. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
  /** Injectable sleep, for tests. */
  sleep?: (ms: number) => Promise<void>
}

/**
 * Run `fn`, retrying on retryable thrown errors with exponential backoff.
 * `fn` must THROW to signal failure; a returned value is taken as success.
 * Re-throws the last error once attempts are exhausted or the error is not
 * retryable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 1000,
    shouldRetry = (error) => isTransientError(errorMessage(error)),
    onRetry,
    sleep: sleepFn = sleep,
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }
      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      onRetry?.({ attempt, delayMs, error })
      await sleepFn(delayMs)
    }
  }
  // Unreachable: the loop either returns or throws.
  throw lastError
}
