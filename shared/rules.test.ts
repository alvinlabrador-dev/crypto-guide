import { describe, expect, it } from "vitest";
import { activePhase, calculateTarget, percentFromAth, shouldTrigger } from "./rules";

describe("price rule engine", () => {
  it("calculates a buy target below ATH", () => {
    expect(calculateTarget({ reference: "ath", offset: "below", percent: 40 }, 100, null)).toBe(60);
  });

  it("calculates a sell target above purchase price", () => {
    expect(calculateTarget({ reference: "purchase", offset: "above", percent: 5 }, 100, 60)).toBe(63);
  });

  it("supports an ATH recovery target", () => {
    expect(calculateTarget({ reference: "ath", offset: "below", percent: 5 }, 100, 60)).toBe(95);
    expect(shouldTrigger("sell", 95, 95)).toBe(true);
  });

  it("uses phase-specific trigger directions", () => {
    expect(shouldTrigger("buy", 59, 60)).toBe(true);
    expect(shouldTrigger("buy", 61, 60)).toBe(false);
    expect(shouldTrigger("sell", 63, 63)).toBe(true);
    expect(shouldTrigger("sell", 62, 63)).toBe(false);
  });

  it("returns null when a required reference is missing", () => {
    expect(calculateTarget({ reference: "purchase", offset: "above", percent: 5 }, 100, null)).toBeNull();
  });

  it("maps statuses and ATH distance", () => {
    expect(activePhase("watching_buy")).toBe("buy");
    expect(activePhase("holding")).toBe("sell");
    expect(activePhase("paused")).toBeNull();
    expect(percentFromAth(60, 100)).toBe(-40);
  });
});
