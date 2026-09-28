// src/utils/format.js

// Assumes INR — flag if bookings are ever in a different currency.
export function formatCurrency(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}