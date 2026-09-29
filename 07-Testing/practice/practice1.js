// Practice 1: A Second Unit Test for a Validation Helper (topic 01)
// Run: npx jest practice/practice1.js
// Needs: jest

// Exercise: write unit tests (no I/O, no Express) for a discount-applying
// helper, covering the normal case AND two edge cases a real reviewer
// would ask about - a discount that would take the price negative, and a
// zero-item cart.

function applyDiscount(subtotalCents, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("discountPercent must be between 0 and 100");
  }
  const discounted = subtotalCents - Math.round((subtotalCents * discountPercent) / 100);
  return Math.max(0, discounted); // never go negative
}

describe("applyDiscount (unit - pure function)", () => {
  it("applies a normal percentage discount", () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
  });

  it("floors at 0 instead of going negative for a 100% discount", () => {
    expect(applyDiscount(5000, 100)).toBe(0);
  });

  it("returns the original amount for a 0% discount", () => {
    expect(applyDiscount(5000, 0)).toBe(5000);
  });

  it("throws for an out-of-range discount percent", () => {
    expect(() => applyDiscount(5000, 150)).toThrow("discountPercent must be between 0 and 100");
  });
});
