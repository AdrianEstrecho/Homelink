import { useEffect } from 'react';
import { X, MapPin, CreditCard, Printer, Download } from 'lucide-react';
import { formatPrice, statusColor } from '../api/client';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import SafeImage from './SafeImage';

export default function OrderDetailsModal({ order, onClose, person, personLabel = 'Customer' }) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto fade-up print-area">
        <div className="hidden print:block text-center px-6 pt-6">
          <p className="font-display text-xl font-bold text-brand-navy">Home<span className="text-brand-orange">Link</span></p>
          <p className="text-xs text-gray-500 tracking-wide uppercase">Official Receipt</p>
        </div>

        <div className="flex items-start justify-between p-6 pb-4 sticky top-0 bg-white border-b border-gray-100">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">Order #{order.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-1 no-print">
            <button onClick={handleDownload} title="Download PDF" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <Download className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={handlePrint} title="Print receipt" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <Printer className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 pt-4 space-y-5">
          <div className="flex gap-2">
            <span className={`badge capitalize ${statusColor(order.status)}`}>{order.status}</span>
            <span className={`badge ${statusColor(order.payment_status)}`}>{order.payment_status}</span>
          </div>

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
              <span className="text-brand-orange">{formatPrice(order.total)}</span>
            </div>
          </div>

          <p className="hidden print:block text-center text-xs text-gray-400 pt-4">Thank you for shopping with HomeLink!</p>
        </div>
      </div>
    </div>
  );
}
