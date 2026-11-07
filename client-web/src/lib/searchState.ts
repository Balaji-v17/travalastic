/**
 * Stale response guard for debounced / concurrent async queries.
 * Ensures only the latest request's response is committed.
 */
export function createStaleGuard() {
  let latestId = 0;
  return {
    /**
     * Start a new query. Returns an incremented sequence id.
     */
    start(): number {
      latestId += 1;
      return latestId;
    },
    /**
     * Check if the given query id is still the latest.
     */
    isCurrent(id: number): boolean {
      return id === latestId;
    },
    /**
     * Invalidate any currently in-flight requests.
     */
    cancel(): void {
      latestId += 1;
    },
  };
}

