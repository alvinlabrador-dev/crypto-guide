import { describe, expect, it } from "vitest";
import { emailIsAllowed, parseEmailAllowlist } from "./allowlist";

describe("parseEmailAllowlist", () => {
  it("splits comma-separated emails", () => {
    const allowlist = parseEmailAllowlist("A@x.com, b@y.com");
    expect(allowlist.has("a@x.com")).toBe(true);
    expect(allowlist.has("b@y.com")).toBe(true);
    expect(allowlist.size).toBe(2);
  });

  it("accepts newlines and ignores values without an at-sign", () => {
    const allowlist = parseEmailAllowlist("you@x.com\nnot-an-email\nfriend@y.com");
    expect([...allowlist]).toEqual(["you@x.com", "friend@y.com"]);
  });

  it("returns an empty set when unset", () => {
    expect(parseEmailAllowlist(undefined).size).toBe(0);
    expect(parseEmailAllowlist("").size).toBe(0);
  });
});

describe("emailIsAllowed", () => {
  it("matches any listed email", () => {
    const allowlist = parseEmailAllowlist("you@driftline.dev");
    expect(emailIsAllowed(["other@x.com", "you@driftline.dev"], allowlist)).toBe(true);
    expect(emailIsAllowed(["stranger@x.com"], allowlist)).toBe(false);
  });
});
