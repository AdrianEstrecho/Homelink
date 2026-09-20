import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, CreditCard, Printer, Download, CheckCircle2, Truck } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import SafeImage from './SafeImage';
import { paymentMethodLabel } from '../constants/paymentMethods';

export default function OrderDetailsModal({
  order, onClose, onDismiss, person, personLabel = 'Customer', onCancelOrder, onTrackOrder, justConfirmed = false,
  previewing = false, onConfirm, confirmLoading = false, error,
}) {
  // On the just-confirmed screen, X/backdrop ("I'm done here") and "Continue to My Orders"
  // ("take me to my orders") are deliberately different exits — onDismiss vs onClose. Every
  // other view (preview, plain order lookup) only has one exit, so they collapse to onClose.
  const handleDismiss = justConfirmed && onDismiss ? onDismiss : onClose;
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
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm no-print" onClick={handleDismiss} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto fade-up print-area print:border print:border-dashed print:border-gray-300">
        {!previewing && (
          <div className="hidden print:block text-center px-6 pt-6 font-mono">
            <p className="text-xl font-bold text-brand-navy">Home<span className="text-brand-orange">Link</span></p>
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mt-1">Home Improvement &amp; Services</p>
            <div className="border-t border-dashed border-gray-300 mt-3 pt-3">
              <p className="text-xs font-bold text-gray-700 tracking-widest uppercase">Official Receipt</p>
              <p className="text-sm font-bold text-brand-navy mt-2">Order #{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{order.status} &middot; {order.payment_status}</p>
            </div>
            <div className="border-t border-dashed border-gray-300 mt-3" />
          </div>
        )}

        <div className="flex items-start justify-between p-6 pb-4 sticky top-0 bg-white border-b border-gray-100 print:hidden">
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
            <button onClick={handleDismiss} title={previewing ? 'Back to edit' : 'Close'} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
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
            <div className="flex items-center justify-between gap-2 print:hidden">
              <div className="flex gap-2">
                <span className={`badge capitalize ${statusColor(order.status)}`}>{order.status}</span>
                <span className={`badge ${statusColor(order.payment_status)}`}>{order.payment_status}</span>
              </div>
              {onTrackOrder && (
                <button onClick={() => onTrackOrder(order)} className="no-print flex items-center gap-1.5 text-xs font-semibold text-brand-teal hover:underline shrink-0">
                  <Truck className="w-3.5 h-3.5" /> Track Order
                </button>
              )}
            </div>
          )}

          {order.status === 'cancelled' && order.cancel_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Cancellation Reason</p>
              <p className="text-sm text-red-800">{order.cancel_reason}</p>
            </div>
          )}

          {person && (
            <div className="print:border-b print:border-dashed print:border-gray-300 print:pb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 print:font-mono">{personLabel}</h3>
              <p className="text-sm font-medium text-gray-800 print:font-mono">{person.name}</p>
              {person.email && <p className="text-sm text-gray-500 print:font-mono">{person.email}</p>}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 print:font-mono print:text-center print:tracking-widest">Items</h3>
            <div className="space-y-3 print:space-y-0">
              {order.items?.map(i => (
                <div key={i.id} className="flex items-center gap-3 print:border-b print:border-dashed print:border-gray-300 print:py-2">
                  {showImages && (
                    <SafeImage src={i.image} alt={i.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 print:hidden" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate print:whitespace-normal print:overflow-visible print:font-mono print:font-bold">{i.name}</p>
                    <p className="text-xs text-gray-500 print:font-mono">Qty {i.quantity} × {formatPrice(i.price)}</p>
                  </div>
                  <p className="font-semibold text-sm print:font-mono">{formatPrice(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {order.shipping_address && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5 print:font-mono">
                <MapPin className="w-3.5 h-3.5 print:hidden" /> Shipping Address
              </h3>
              <p className="text-sm text-gray-700 print:font-mono">{order.shipping_address}</p>
            </div>
          )}

          {order.payment_method && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5 print:font-mono">
                <CreditCard className="w-3.5 h-3.5 print:hidden" /> Payment Method
              </h3>
              <p className="text-sm text-gray-700 print:font-mono">{paymentMethodLabel(order.payment_method)}</p>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-sm print:border-dashed print:font-mono">
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
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100 print:border-double print:border-t-4 print:border-brand-navy print:text-brand-navy print:pt-3">
              <span>Total</span>
              <span className="text-brand-navy">{formatPrice(order.total)}</span>
            </div>
          </div>

          <div className="hidden print:block text-center pt-4 border-t border-dashed border-gray-300 mt-4 font-mono">
            <p className="text-xs text-gray-500">Thank you for shopping with HomeLink!</p>
            <p className="text-xs text-gray-300 tracking-widest mt-2">* * * * * * * * * * * * *</p>
          </div>

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
