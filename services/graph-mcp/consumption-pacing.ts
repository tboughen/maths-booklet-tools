/** Observe the original request pacing without changing production quotas. */
export function consumptionPacer({ now = Date.now, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) } = {}) {
  let requests = 0, windowStarted = now();
  const metrics = { requests: 0, windowWaits: 0, waitMs: 0 };
  return {
    metrics,
    async beforeRequest() {
      metrics.requests++;
      if (++requests >= 32) {
        const duration = Math.max(0, 61_000 - (now() - windowStarted));
        metrics.windowWaits++;
        const start = now();
        await wait(duration);
        metrics.waitMs += Math.max(0, now() - start);
        requests = 1;
        windowStarted = now();
      }
    },
  };
}
