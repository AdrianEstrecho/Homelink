import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, CreditCard, Printer, Download, CheckCircle2 } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import SafeImage from './SafeImage';

export default function OrderDetailsModal({
  order, onClose, person, personLabel = 'Customer', onCancelOrder, justConfirmed = false,
  previewing = false, onConfirm, confirmLoading = false, error,
}) {
  useEffect(() => {
    const cleanup = () => document.body.classList.remove('printing-active');
    window.addEventListener('afterprint', cleanup);
    return () => { cleanup(); window.removeEventListener('afterprint', cleanup); };
  }, []);

  const handlePrint = () => {
    document.body.classList.add('printing-active');
    window.print();
  };

  const handleDownload = () => downloadReceiptPdf(order, person, personLabel);

  const showImages = order.items?.some(i => i.image);

  // Portaled to <body> — same reasoning as ConfirmDialog/PromptDialog/TermsModal: rendered
  // inline, this ended up boxed inside its position in the page (visible page content, e.g.
  // the footer, painting over the lower half of the panel) instead of sitting above everything.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto fade-up print-area">
        <div className="hidden print:block text-center px-6 pt-6">
          <p className="font-display text-xl font-bold text-brand-navy">Home<span className="text-brand-orange">Link</span></p>
          <p className="text-xs text-gray-500 tracking-wide uppercase">Official Receipt</p>
        </div>

        <div className="flex items-start justify-between p-6 pb-4 sticky top-0 bg-white border-b border-gray-100">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">
              {previewing ? 'Review Your Order' : `Order #${order.id.slice(0, 8).toUpperCase()}`}
            </h2>
            <p className="text-sm text-gray-500">
              {previewing ? 'Nothing is placed yet — check the details below.' : new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1 no-print">
            {!previewing && (
              <>
                <button onClick={handleDownload} title="Download PDF" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                  <Download className="w-5 h-5 text-gray-500" />
                </button>
                <button onClick={handlePrint} title="Print receipt" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                  <Printer className="w-5 h-5 text-gray-500" />
                </button>
              </>
            )}
            <button onClick={onClose} title={previewing ? 'Back to edit' : 'Close'} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-5">
          {justConfirmed && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 no-print">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Order confirmed!</p>
                <p className="text-sm text-green-700 mt-0.5">
                  {person?.email
                    ? `We've emailed a copy of this receipt to ${person.email}.`
                    : "We've emailed a copy of this receipt to your account email."}
                </p>
              </div>
            </div>
          )}

          {!previewing && (
            <div className="flex gap-2">
              <span className={`badge capitalize ${statusColor(order.status)}`}>{order.status}</span>
              <span className={`badge ${statusColor(order.payment_status)}`}>{order.payment_status}</span>
            </div>
          )}

          {order.status === 'cancelled' && order.cancel_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Cancellation Reason</p>
              <p className="text-sm text-red-800">{order.cancel_reason}</p>
            </div>
          )}

          {person && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{personLabel}</h3>
              <p className="text-sm font-medium text-gray-800">{person.name}</p>
              {person.email && <p className="text-sm text-gray-500">{person.email}</p>}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Items</h3>
            <div className="space-y-3">
              {order.items?.map(i => (
                <div key={i.id} className="flex items-center gap-3">
                  {showImages && (
                    <SafeImage src={i.image} alt={i.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 print:hidden" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{i.name}</p>
                    <p className="text-xs text-gray-500">Qty {i.quantity} × {formatPrice(i.price)}</p>
                  </div>
                  <p className="font-semibold text-sm">{formatPrice(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {order.shipping_address && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Shipping Address
              </h3>
              <p className="text-sm text-gray-700">{order.shipping_address}</p>
            </div>
          )}

          {order.payment_method && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment Method
              </h3>
              <p className="text-sm text-gray-700 capitalize">{order.payment_method}</p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount {order.promo_code && `(${order.promo_code})`}</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-gray-100">
              <span>Total</span>
              <span className="text-brand-navy">{formatPrice(order.total)}</span>
            </div>
          </div>

          <p className="hidden print:block text-center text-xs text-gray-400 pt-4">Thank you for shopping with HomeLink!</p>

          {justConfirmed && (
            <button onClick={onClose} className="btn-primary w-full py-3 no-print">
              Continue to My Orders
            </button>
          )}

          {previewing && (
            <div className="no-print space-y-3">
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={onClose} disabled={confirmLoading} className="btn-secondary flex-1 py-3 disabled:opacity-50">
                  Edit Order
                </button>
                <button onClick={onConfirm} disabled={confirmLoading} className="btn-primary flex-1 py-3 disabled:opacity-50">
                  {confirmLoading ? 'Placing Order...' : 'Confirm & Place Order'}
                </button>
              </div>
            </div>
          )}

          {onCancelOrder && order.status === 'pending' && (
            <button
              onClick={() => onCancelOrder(order)}
              className="no-print w-full border border-red-200 text-red-600 rounded-lg py-2.5 font-semibold text-sm hover:bg-red-50 transition"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
