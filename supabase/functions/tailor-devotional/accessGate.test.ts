import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ACCESS_REQUIRED_ERROR,
  checkAccessToken,
  hashAccessToken,
  isWellFormedAccessToken,
} from "./accessGate.ts";

// The access gate (Nov 20, 2026): gate the spend, not the page. These
// tests pin the whole discipline — shape first (no lookup for a token
// that could not be ours), one hashed lookup, active-only passage, and
// failure CLOSED on every error path. The handler's own ordering (gate
// before the piece/PM/build branches and before every quota) is pinned
// by source position below. This function's copy of the gate is
// identical to chat-proxy's; the two test files differ only in the
// ordering block, which is each handler's own.

const TOKEN = "test-token-0123456789abcdef";
const ENV = { supabaseUrl: "https://example.supabase.co", apiKey: "anon-key" };

beforeAll(() => {
  // The module reads Deno.env for its defaults in production; the test
  // runtime has no Deno global, so stand in an empty one. Every check
  // below passes its env explicitly except the misconfiguration case.
  (globalThis as Record<string, unknown>).Deno = { env: { get: () => undefined } };
});

function lookupFetch(verdict: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => verdict,
  })) as unknown as typeof fetch;
}

describe("isWellFormedAccessToken", () => {
  it("accepts a long unspaced string", () => {
    expect(isWellFormedAccessToken(TOKEN)).toBe(true);
  });

  it("refuses the absent, the short, the spaced, and the non-string", () => {
    expect(isWellFormedAccessToken(undefined)).toBe(false);
    expect(isWellFormedAccessToken(null)).toBe(false);
    expect(isWellFormedAccessToken("")).toBe(false);
    expect(isWellFormedAccessToken("short")).toBe(false);
    expect(isWellFormedAccessToken("has a space in it........")).toBe(false);
    expect(isWellFormedAccessToken(12345678901234567890)).toBe(false);
    expect(isWellFormedAccessToken("x".repeat(201))).toBe(false);
  });
});

describe("hashAccessToken", () => {
  it("is the SHA-256 hex of the token — the only form the database holds", async () => {
    const { createHash } = await import("node:crypto");
    const expected = createHash("sha256").update(TOKEN).digest("hex");
    expect(await hashAccessToken(TOKEN)).toBe(expected);
    expect(await hashAccessToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("checkAccessToken", () => {
  it("passes an active token — and sends the HASH to the verdict door, never the raw token", async () => {
    const fetchImpl = lookupFetch(true);
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl })).resolves.toBe(true);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { body?: string },
    ];
    expect(url).toContain("/rest/v1/rpc/check_access_token");
    expect(init.body).toContain(await hashAccessToken(TOKEN));
    expect(init.body).not.toContain(TOKEN);
    expect(url).not.toContain(TOKEN);
  });

  it("refuses a token the door answers false for (revoked or unknown)", async () => {
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: lookupFetch(false) })).resolves.toBe(false);
  });

  it("refuses a non-boolean answer from the door", async () => {
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: lookupFetch("true") })).resolves.toBe(false);
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: lookupFetch(null) })).resolves.toBe(false);
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: lookupFetch([{ status: "active" }]) })).resolves.toBe(
      false,
    );
  });

  it("refuses a missing or malformed token WITHOUT any lookup", async () => {
    const fetchImpl = lookupFetch(true);
    await expect(checkAccessToken(undefined, { ...ENV, fetchImpl })).resolves.toBe(false);
    await expect(checkAccessToken("short", { ...ENV, fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails CLOSED when the lookup errors, throws, or is misconfigured", async () => {
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: lookupFetch(null, 500) })).resolves.toBe(false);
    const throwing = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(checkAccessToken(TOKEN, { ...ENV, fetchImpl: throwing })).resolves.toBe(false);
    await expect(checkAccessToken(TOKEN, { fetchImpl: lookupFetch(true) })).resolves.toBe(false);
  });

  it("the refusal code is the stable machine string", () => {
    expect(ACCESS_REQUIRED_ERROR).toBe("access_required");
  });
});

describe("the handler's ordering — gate before every branch and quota", () => {
  const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

  it("tailor-devotional checks the token ahead of the piece, PM, and build paths", () => {
    const gateAt = source.indexOf("checkAccessToken(payload.accessToken)");
    expect(gateAt).toBeGreaterThan(-1);
    // The piece branch — whose own HMAC checks stand IN ADDITION inside
    // its handler, never instead of the gate.
    expect(gateAt).toBeLessThan(source.indexOf("payload.piece !== undefined"));
    expect(source).toContain("verifyPieceToken");
    // The PM branch and the build quota alike stand behind the gate.
    expect(gateAt).toBeLessThan(source.indexOf('payload.mode === "pm"'));
    expect(gateAt).toBeLessThan(source.indexOf("await withinQuota(req)"));
    expect(source).toContain("error: ACCESS_REQUIRED_ERROR }, 403");
  });
});
