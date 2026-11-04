import { describe, expect, it } from "vitest";
import { stockAdjustmentQuantity } from "./stock-adjustment";

describe("direct stock correction", () => {
  it("accepts the exact new balance including zero for losses", () => {
    expect(stockAdjustmentQuantity("7")).toBe(7);
    expect(stockAdjustmentQuantity("0")).toBe(0);
  });
  it("rejects missing, negative, fractional and out-of-range balances", () => {
    for (const value of ["", " ", "-1", "1.5", "Infinity", "2147483648"]) {
      expect(stockAdjustmentQuantity(value)).toBeNull();
    }
  });
});