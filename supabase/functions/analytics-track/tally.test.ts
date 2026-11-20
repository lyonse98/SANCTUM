import { describe, expect, it } from "vitest";
import { hashTallyToken, validateTallyPayload } from "./tally.ts";

// The counts-only tally (Nov 20, 2026): validation is whole-or-nothing
// on shape, drop-and-cap on ids. These tests pin both halves — a
// malformed payload stores nothing at all, and a well-shaped one can
// never smuggle an id the profile itself could not hold.
const TOKEN = "123e4567-e89b-42d3-a456-426614174000";

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tallyToken: TOKEN,
    audience: "men",
    voices: ["fr-mike", "huberman"],
    seasonOfLife: "father-young",
    ongoingBattles: ["Fatherhood", "Work pressure"],
    northStar: "be-still",
    ...overrides,
  };
}

describe("validateTallyPayload", () => {
  it("accepts a well-shaped snapshot with its ids intact", () => {
    expect(validateTallyPayload(payload())).toEqual({
      tallyToken: TOKEN,
      audience: "men",
      voices: ["fr-mike", "huberman"],
      seasonOfLife: "father-young",
      ongoingBattles: ["Fatherhood", "Work pressure"],
      northStar: "be-still",
    });
  });

  it("accepts the erase snapshot — every pick empty", () => {
    expect(
      validateTallyPayload(payload({ voices: [], seasonOfLife: null, ongoingBattles: [], northStar: null })),
    ).toEqual({
      tallyToken: TOKEN,
      audience: "men",
      voices: [],
      seasonOfLife: null,
      ongoingBattles: [],
      northStar: null,
    });
  });

  it("drops ids outside the owning track's vocabulary — including the other track's", () => {
    const out = validateTallyPayload(
      payload({
        voices: ["fr-mike", "sr-miriam", "not-a-voice"],
        seasonOfLife: "expecting", // a women's season, not a men's
        ongoingBattles: ["Fatherhood", "Trust"], // Trust is a women's battle word
        northStar: "fiat", // a women's-menu star
      }),
    );
    expect(out).toEqual({
      tallyToken: TOKEN,
      audience: "men",
      voices: ["fr-mike"],
      seasonOfLife: null,
      ongoingBattles: ["Fatherhood"],
      northStar: null,
    });
  });

  it("caps voices at the profile's five and dedupes both arrays", () => {
    const out = validateTallyPayload(
      payload({
        voices: ["fr-mike", "barron", "fradd", "roumie", "cavins", "west", "hahn"],
        ongoingBattles: ["Guilt", "Guilt", "Shame", "Guilt"],
      }),
    );
    expect(out?.voices).toEqual(["fr-mike", "barron", "fradd", "roumie", "cavins"]);
    expect(out?.ongoingBattles).toEqual(["Guilt", "Shame"]);
  });

  it("rejects a token that is not a UUID, and one that is not a string", () => {
    expect(validateTallyPayload(payload({ tallyToken: "not-a-uuid" }))).toBeNull();
    expect(validateTallyPayload(payload({ tallyToken: 42 }))).toBeNull();
    expect(validateTallyPayload(payload({ tallyToken: undefined }))).toBeNull();
  });

  it("rejects an unknown track", () => {
    expect(validateTallyPayload(payload({ audience: "both" }))).toBeNull();
    expect(validateTallyPayload(payload({ audience: undefined }))).toBeNull();
  });

  it("rejects fields of the wrong type — nothing partial is stored", () => {
    expect(validateTallyPayload(payload({ voices: "fr-mike" }))).toBeNull();
    expect(validateTallyPayload(payload({ ongoingBattles: "Grief" }))).toBeNull();
    expect(validateTallyPayload(payload({ seasonOfLife: 7 }))).toBeNull();
    expect(validateTallyPayload(payload({ northStar: ["be-still"] }))).toBeNull();
  });

  it("rejects non-object payloads", () => {
    expect(validateTallyPayload(null)).toBeNull();
    expect(validateTallyPayload("tally")).toBeNull();
    expect(validateTallyPayload([payload()])).toBeNull();
  });

  it("ignores keys outside the allowlist — they never reach the store", () => {
    const out = validateTallyPayload(payload({ standingGoal: "be present", anything: "else" }));
    expect(out).not.toBeNull();
    expect(Object.keys(out!).sort()).toEqual(
      ["audience", "northStar", "ongoingBattles", "seasonOfLife", "tallyToken", "voices"].sort(),
    );
  });
});

describe("hashTallyToken", () => {
  it("produces a stable 64-char hex digest, different per token", async () => {
    const a = await hashTallyToken(TOKEN);
    const b = await hashTallyToken(TOKEN);
    const c = await hashTallyToken("123e4567-e89b-42d3-a456-426614174001");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain(TOKEN);
  });
});
