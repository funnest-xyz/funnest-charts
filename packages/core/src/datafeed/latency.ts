/**
 * Periodically times an async probe (e.g. a tiny REST call) as a latency estimate, for venues
 * whose WebSocket has no usable ping. Returns a stop function.
 */
export function monitorLatency(probe: () => Promise<unknown>, onLatency: (ms: number) => void, interval = 10_000): () => void {
  let stopped = false;
  const run = async () => {
    const start = performance.now();
    try {
      await probe();
      if (!stopped) onLatency(Math.round(performance.now() - start));
    } catch {
      /* the socket status already reflects outages */
    }
  };
  void run();
  const timer = setInterval(run, interval);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
