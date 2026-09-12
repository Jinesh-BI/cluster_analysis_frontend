// src/utils/format.js

// Assumes INR — flag if bookings are ever in a different currency.
export function formatCurrency(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
