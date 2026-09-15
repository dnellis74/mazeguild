/**
 * Next.js 16.3 can attach more than Node's default 10 `close` listeners on a
 * single ServerResponse (App Router + compression + abort controllers). That
 * trips MaxListenersExceededWarning even when nothing is leaking — see
 * vercel/next.js#97757 / discussion #96973. Raise the process default so those
 * legitimate per-response handlers stay quiet until Next cleans them up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { EventEmitter } = await import("node:events");
  if (EventEmitter.defaultMaxListeners < 20) {
    EventEmitter.defaultMaxListeners = 20;
  }
}
