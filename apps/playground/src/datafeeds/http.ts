/** fetch → JSON with one polite retry on rate limiting (HTTP 429). */
export async function getJson<T>(url: string, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }
    throw new Error(`funnest-charts datafeed: ${res.status} ${res.statusText} — ${url}`);
  }
}
