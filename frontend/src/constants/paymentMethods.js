import { CreditCard, Smartphone, Landmark, QrCode, Banknote } from 'lucide-react';

// `gateway: true` means the customer is handed off to PayMongo's hosted page and the order is
// only created once the charge is confirmed; the rest collect money outside the app, so their
// order is created immediately with payment_status 'pending' (see backend/routes/orders.js).
//
// `deliveryOnly` methods are hidden wherever nothing is being delivered — the same picker
// drives service bookings, where a technician visit has no rider to hand cash to.
export const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard & more', icon: CreditCard, gateway: true },
  { value: 'gcash', label: 'GCash', description: 'Pay with your wallet', icon: Smartphone, gateway: true },
  { value: 'qrph', label: 'QR Ph', description: 'Scan with any app', icon: QrCode, gateway: true },
  { value: 'bank', label: 'Bank Transfer', description: 'Direct bank deposit', icon: Landmark, gateway: false },
  { value: 'cod', label: 'Cash on Delivery', description: 'Pay the rider in cash', icon: Banknote, gateway: false, deliveryOnly: true },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]));

// Orders and bookings store the wire value ('gcash', 'qrph', 'cod'), which a plain CSS
// `capitalize` renders as "Gcash", "Qrph" and "Cod" on receipts and order details.
export function paymentMethodLabel(method) {
  if (!method) return '';
  return PAYMENT_METHOD_LABELS[method] || method.charAt(0).toUpperCase() + method.slice(1);
}

// True for the methods that skip PayMongo entirely, so checkout POSTs straight to /orders
// instead of redirecting out to a hosted checkout session.
export function isOfflinePayment(method) {
  return PAYMENT_METHODS.some(m => m.value === method && !m.gateway);
}
