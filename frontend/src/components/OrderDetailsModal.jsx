import { useEffect } from 'react';
import { MapPin, CreditCard, Printer, Download, CheckCircle2, CircleCheckBig, Truck, RotateCcw, ReceiptText, ClipboardCheck, Loader2 } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from './Modal';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import SafeImage from './SafeImage';
import { LogoMark } from './brand/Logo';
import { paymentMethodLabel } from '../constants/paymentMethods';

export default function OrderDetailsModal({
  order, onClose, onDismiss, person, personLabel = 'Customer', onCancelOrder, onTrackOrder, onReturnOrder, onCompleteOrder, justConfirmed = false,
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

  // The customer's sign-off (completed_at) sits on top of a row that stays 'delivered' — see
  // PUT /orders/:id/complete — so it's read here rather than from status. Teal, not the green
  // statusColor() gives delivered, so the two can't be confused side by side.
  const completed = order.status === 'delivered' && !!order.completed_at;
  const shownStatus = completed ? 'completed' : order.status;
  const shownStatusClass = completed ? 'bg-teal-100 text-teal-800' : statusColor(order.status);

  const showCancel = onCancelOrder && order.status === 'pending';
  const showReturn = onReturnOrder && order.canReturn;
  const hasFooter = justConfirmed || previewing || showCancel || showReturn || onCompleteOrder;

  // The panel itself is the .print-area: printing shows just this receipt (see index.css).
  return (
    <Modal onClose={handleDismiss} dismissible={!confirmLoading} scrimClassName="no-print" className="print-area print:border print:border-dashed print:border-gray-300">
        {!previewing && (
          <div className="hidden print:block text-center px-6 pt-6 font-mono">
            <LogoMark className="w-12 mx-auto mb-1.5 text-brand-navy" />
            <p className="text-xl font-bold text-brand-navy">Home<span className="text-brand-orange">Link</span></p>
            <p className="text-[10px] text-gray-400 tracking-widest uppercase mt-1">Home Improvement &amp; Services</p>
            <div className="border-t border-dashed border-gray-300 mt-3 pt-3">
              <p className="text-xs font-bold text-gray-700 tracking-widest uppercase">Official Receipt</p>
              <p className="text-sm font-bold text-brand-navy mt-2">Order #{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-500 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5 capitalize">{shownStatus} &middot; {order.payment_status}</p>
            </div>
            <div className="border-t border-dashed border-gray-300 mt-3" />
          </div>
        )}

        <ModalHeader
          className="print:hidden"
          icon={previewing ? ClipboardCheck : ReceiptText}
          title={previewing ? 'Review your order' : `Order #${order.id.slice(0, 8).toUpperCase()}`}
          subtitle={previewing ? 'Nothing is placed yet — check the details below.' : new Date(order.created_at).toLocaleString()}
          actions={!previewing && (
            <>
              <button type="button" onClick={handleDownload} title="Download PDF" aria-label="Download PDF receipt" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                <Download className="w-[18px] h-[18px]" />
              </button>
              <button type="button" onClick={handlePrint} title="Print receipt" aria-label="Print receipt" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
                <Printer className="w-[18px] h-[18px]" />
              </button>
            </>
          )}
        />

        <ModalBody className="space-y-5 print:overflow-visible">
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
                <span className={`badge capitalize ${shownStatusClass}`}>{shownStatus}</span>
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

          {completed && (
            <div className="flex items-start gap-2.5 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5 print:hidden">
              <CircleCheckBig className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-teal-800">
                Completed on {new Date(order.completed_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
                Returns and refunds are closed for this order.
              </p>
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
            {order.shipping_fee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{formatPrice(order.shipping_fee)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax ({Number(order.tax_rate)}%)</span>
                <span>{formatPrice(order.tax)}</span>
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

          {previewing && error && <p role="alert" className="no-print text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </ModalBody>

        {hasFooter && (
          <ModalFooter className="no-print">
            {showCancel && (
              <button type="button" onClick={() => onCancelOrder(order)} className={`${modalButton.base} border border-red-200 bg-white text-red-600 hover:bg-red-50 sm:mr-auto`}>
                Cancel order
              </button>
            )}
            {/* canReturn comes from the server (delivered, inside the 7-day window, and with units
                not already spoken for) — the modal never works it out from the order itself. */}
            {showReturn && (
              <button type="button" onClick={() => onReturnOrder(order)} className={`${modalButton.base} ${modalButton.secondary}`}>
                <RotateCcw className="w-4 h-4" /> Return or refund
              </button>
            )}
            {/* The caller decides eligibility (delivered, not completed, nothing on its way back) and
                only passes this when it holds; the server re-checks all of it under a row lock. */}
            {onCompleteOrder && (
              <button type="button" onClick={() => onCompleteOrder(order)} className={`${modalButton.base} bg-brand-teal text-white hover:bg-teal-600`}>
                <CircleCheckBig className="w-4 h-4" /> Mark as completed
              </button>
            )}
            {previewing && (
              <>
                <button type="button" onClick={onClose} disabled={confirmLoading} className={`${modalButton.base} ${modalButton.secondary}`}>
                  Edit order
                </button>
                <button type="button" onClick={onConfirm} disabled={confirmLoading} className={`${modalButton.base} ${modalButton.primary}`}>
                  {confirmLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing order…</> : 'Confirm & place order'}
                </button>
              </>
            )}
            {justConfirmed && (
              <button type="button" onClick={onClose} className={`${modalButton.base} ${modalButton.primary}`}>
                Continue to My Orders
              </button>
            )}
          </ModalFooter>
        )}
    </Modal>
  );
}
