/**
 * Tests for the transient-failure retry helper used by image/data workers.
 *
 * Motivated by an image-gen run that failed the whole batch when a single
 * Supabase Storage upload returned a Gateway Timeout — a transient error that
 * should be retried rather than treated as fatal.
 */

import { describe, it, expect, vi } from "vitest"
import { withRetry, isTransientError, errorMessage } from "../../workers/shared/retry"

describe("isTransientError", () => {
  it("flags gateway timeouts and 5xx/429 as retryable", () => {
    for (const msg of [
      "Gateway Timeout",
      "504 Gateway Timeout",
      "Bad Gateway (502)",
      "503 Service Unavailable",
      "Internal error (500)",
      "Too Many Requests",
      "429 rate limited",
      "request timed out",
      "fetch failed",
      "ECONNRESET",
      "socket hang up",
      "other side terminated",
    ]) {
      expect(isTransientError(msg), msg).toBe(true)
    }
  })

  it("does not retry client/auth/policy errors", () => {
    for (const msg of [
      "Invalid API key",
      "Bucket not found",
      "new row violates row-level security policy",
      "400 Bad Request",
      "Payload too large",
      "The resource already exists",
    ]) {
      expect(isTransientError(msg), msg).toBe(false)
    }
  })
})

describe("withRetry", () => {
  const noSleep = vi.fn(async (_ms: number) => {})

  it("returns the result on first success without sleeping", async () => {
    const fn = vi.fn(async () => "ok")
    const result = await withRetry(fn, { sleep: noSleep })
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(noSleep).not.toHaveBeenCalled()
  })

  it("retries a transient failure then succeeds", async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 3) throw new Error("Gateway Timeout")
      return "recovered"
    })

    const result = await withRetry(fn, { sleep })

    expect(result).toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(3)
    // Exponential backoff: 1000ms, then 2000ms before the two retries.
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
  })

  it("gives up after maxAttempts and throws the last error", async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const fn = vi.fn(async () => {
      throw new Error("503 Service Unavailable")
    })

    await expect(
      withRetry(fn, { maxAttempts: 3, sleep })
    ).rejects.toThrow("503 Service Unavailable")

    expect(fn).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2) // sleeps between attempts only
  })

  it("does not retry non-transient errors", async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    const fn = vi.fn(async () => {
      throw new Error("Invalid API key")
    })

    await expect(withRetry(fn, { sleep })).rejects.toThrow("Invalid API key")

    expect(fn).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it("honors a custom shouldRetry predicate", async () => {
    const sleep = vi.fn(async (_ms: number) => {})
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 2) throw new Error("custom retryable")
      return "done"
    })

    const result = await withRetry(fn, {
      sleep,
      shouldRetry: (e) => errorMessage(e).includes("custom"),
    })

    expect(result).toBe("done")
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
