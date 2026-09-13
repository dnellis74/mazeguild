/**
 * Deduplicate concurrent identical JSON fetches.
 * React Strict Mode (dev) remounts and re-runs effects; without this, every
 * mount-time API call fires twice. Concurrent callers with the same
 * method+url+body share one Promise; the entry clears when it settles so
 * later intentional retries still work.
 */
const inflight = new Map<string, Promise<FetchJsonResult<unknown>>>();

export type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

function requestKey(url: string, init?: RequestInit): string {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : "";
  return `${method}:${url}:${body}`;
}

export function fetchJsonOnce<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<FetchJsonResult<T>> {
  const key = requestKey(url, init);
  const existing = inflight.get(key) as Promise<FetchJsonResult<T>> | undefined;
  if (existing) return existing;

  const pending = (async (): Promise<FetchJsonResult<T>> => {
    const res = await fetch(url, init);
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  })();

  inflight.set(key, pending as Promise<FetchJsonResult<unknown>>);
  void pending.finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key);
  });

  return pending;
}
