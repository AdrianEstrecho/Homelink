import { AlertTriangle } from 'lucide-react';

// Marks an order/booking the backend had to create even though something ran out while the
// customer was on PayMongo's page (stock, a voucher's last use, or the booking's time slot) —
// the payment already went through, so staff need to restock, refund, or reschedule.
export default function NeedsReviewFlag({ reason }) {
  return (
    <p className="mt-1.5 flex items-start gap-1 text-xs text-red-700 max-w-xs" title={reason}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span><span className="font-semibold">Needs review:</span> {reason}</span>
    </p>
  );
}
