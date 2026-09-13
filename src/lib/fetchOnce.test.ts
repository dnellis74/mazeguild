import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonOnce } from "./fetchOnce";

describe("fetchJsonOnce", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one in-flight request for identical calls", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const [a, b] = await Promise.all([
      fetchJsonOnce<{ ok: boolean }>("/api/test", {
        method: "POST",
        body: JSON.stringify({ x: 1 }),
      }),
      fetchJsonOnce<{ ok: boolean }>("/api/test", {
        method: "POST",
        body: JSON.stringify({ x: 1 }),
      }),
    ]);

    expect(calls).toBe(1);
    expect(a.ok).toBe(true);
    expect(b.data.ok).toBe(true);
    expect(a).toBe(b);
  });

  it("allows a second request after the first settles", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return new Response(JSON.stringify({ n: calls }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await fetchJsonOnce("/api/again");
    await fetchJsonOnce("/api/again");
    expect(calls).toBe(2);
  });
});
