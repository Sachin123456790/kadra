import { describe, it, expect } from "vitest";
import { currency } from "./api";
describe("financial display precision", () => {
  it("preserves cents beyond the safe floating-point integer range", () => {
    expect(currency("999999999999999.99")).toBe("$999,999,999,999,999.99");
    expect(currency("-0.01")).toBe("-$0.01");
    expect(currency("1000000.00")).toBe("$1,000,000.00");
    expect(currency("NaN")).toBe("Unavailable");
  });
});
