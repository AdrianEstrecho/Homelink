import { forwardRef, useImperativeHandle, useState } from 'react';
import { CreditCard, Smartphone, Landmark, QrCode, ShieldCheck, Copy, Check } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard & more', icon: CreditCard },
  { value: 'gcash', label: 'GCash', description: 'Pay with your wallet', icon: Smartphone },
  { value: 'qrph', label: 'QR Ph', description: 'Scan with any app', icon: QrCode },
  { value: 'bank', label: 'Bank Transfer', description: 'Direct bank deposit', icon: Landmark },
];

const ONLINE_NOTE = {
  card: 'You’ll be taken to a secure PayMongo page to enter your card details.',
  gcash: 'You’ll be taken to a secure PayMongo page to log in and authorize this payment.',
  qrph: 'You’ll be taken to a secure PayMongo page to scan a QR code with GCash, Maya, or your bank’s app.',
};

const BANK_DETAILS = { bank: 'BDO Unibank', accountName: 'HomeLink Home Improvement Inc.', accountNumber: '0012 3456 7890' };

const PaymentMethodPicker = forwardRef(function PaymentMethodPicker({ stepNumber = 2 }, ref) {
  const [method, setMethod] = useState('card');
  const [bankCopied, setBankCopied] = useState(false);

  const handleCopyBank = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(BANK_DETAILS.accountNumber.replace(/\s/g, '')).then(() => {
      setBankCopied(true);
      setTimeout(() => setBankCopied(false), 1500);
    }).catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    validate: () => ({ method }),
  }), [method]);

  return (
    <div>
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
        <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{stepNumber}</span>
        Payment Method
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PAYMENT_METHODS.map(m => (
          <label key={m.value} className={`flex flex-col items-center text-center gap-1.5 p-4 rounded-xl border cursor-pointer transition ${method === m.value ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="radio" name="payment" className="sr-only" checked={method === m.value} onChange={() => setMethod(m.value)} />
            <m.icon className={`w-6 h-6 mb-1 ${method === m.value ? 'text-brand-orange' : 'text-gray-400'}`} />
            <span className="text-sm font-semibold text-brand-ink">{m.label}</span>
            <span className="text-xs text-gray-400">{m.description}</span>
          </label>
        ))}
      </div>

      {ONLINE_NOTE[method] && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" /> {ONLINE_NOTE[method]}
          </p>
        </div>
      )}

      {method === 'bank' && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2.5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Bank</span><span className="font-medium text-brand-ink">{BANK_DETAILS.bank}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Account Name</span><span className="font-medium text-brand-ink">{BANK_DETAILS.accountName}</span></div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Account Number</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-brand-ink">{BANK_DETAILS.accountNumber}</span>
                <button type="button" onClick={handleCopyBank} title="Copy account number" className="text-gray-400 hover:text-brand-teal transition">
                  {bankCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Please use your reference number as the payment reference.</p>
        </div>
      )}
    </div>
  );
});

export default PaymentMethodPicker;
