// Pure functions, no DB/network - kept separate so they're trivially unit-testable (see tests/pricing.test.js)

function calculateOrderTotal(items) {
  // items: [{ priceCentsAtPurchase, quantity }]
  return items.reduce((total, item) => total + item.priceCentsAtPurchase * item.quantity, 0);
}

function buildOrderItemsFromCart(cartItems) {
  // cartItems: [{ product: { _id, name, priceCents, stock }, quantity }]
  return cartItems.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    quantity: item.quantity,
    priceCentsAtPurchase: item.product.priceCents,
  }));
}

module.exports = { calculateOrderTotal, buildOrderItemsFromCart };
