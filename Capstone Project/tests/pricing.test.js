const { calculateOrderTotal, buildOrderItemsFromCart } = require("../utils/pricing");

describe("calculateOrderTotal", () => {
  it("sums price * quantity across items", () => {
    const total = calculateOrderTotal([
      { priceCentsAtPurchase: 1000, quantity: 2 },
      { priceCentsAtPurchase: 500, quantity: 3 },
    ]);
    expect(total).toBe(1000 * 2 + 500 * 3);
  });

  it("returns 0 for an empty order", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});

describe("buildOrderItemsFromCart", () => {
  it("snapshots product name and price at purchase time", () => {
    const cartItems = [
      { product: { _id: "p1", name: "Shoes", priceCents: 6000 }, quantity: 2 },
    ];

    const orderItems = buildOrderItemsFromCart(cartItems);

    expect(orderItems).toEqual([
      { product: "p1", name: "Shoes", quantity: 2, priceCentsAtPurchase: 6000 },
    ]);
  });

  it("keeps the snapshot even if the caller mutates the original product afterwards", () => {
    const product = { _id: "p1", name: "Shoes", priceCents: 6000 };
    const cartItems = [{ product, quantity: 1 }];

    const orderItems = buildOrderItemsFromCart(cartItems);
    product.priceCents = 9999; // simulate the product price changing later

    expect(orderItems[0].priceCentsAtPurchase).toBe(6000);
  });
});
