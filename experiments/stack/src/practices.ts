// Explicit task lifecycle: caller must await admission; failure is not hidden by void.
export async function admit<T>(publish: (signal: AbortSignal) => Promise<T>, timeoutMs = 1500): Promise<T> {
  return await publish(AbortSignal.timeout(timeoutMs))
}

export function reportFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown failure'
}
