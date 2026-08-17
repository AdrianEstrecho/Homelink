import { forwardRef, useImperativeHandle, useState } from 'react';
import { CreditCard, Smartphone, Landmark, ShieldCheck, Copy, Check } from 'lucide-react';
import Select from './Select';

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard & more', icon: CreditCard },
  { value: 'gcash', label: 'GCash', description: 'Pay with your wallet', icon: Smartphone },
  { value: 'bank', label: 'Bank Transfer', description: 'Direct bank deposit', icon: Landmark },
];

const BANK_DETAILS = { bank: 'BDO Unibank', accountName: 'HomeLink Home Improvement Inc.', accountNumber: '0012 3456 7890' };

const emptyCardForm = { cardNumber: '', expMonth: '', expYear: '', cvc: '' };
const cardYearOptions = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

const PaymentMethodPicker = forwardRef(function PaymentMethodPicker({ stepNumber = 2 }, ref) {
  const [method, setMethod] = useState('card');

  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [cardError, setCardError] = useState('');

  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashError, setGcashError] = useState('');

  const [bankCopied, setBankCopied] = useState(false);

  const handleCopyBank = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(BANK_DETAILS.accountNumber.replace(/\s/g, '')).then(() => {
      setBankCopied(true);
      setTimeout(() => setBankCopied(false), 1500);
    }).catch(() => {});
  };

  useImperativeHandle(ref, () => ({
    validate: () => {
      if (method === 'card') {
        const digits = cardForm.cardNumber.replace(/\D/g, '');
        if (digits.length < 12 || digits.length > 19) { setCardError('Enter a valid card number'); return null; }
        const month = Number(cardForm.expMonth), year = Number(cardForm.expYear);
        if (!month || month < 1 || month > 12 || !year) { setCardError('Enter a valid expiry date'); return null; }
        if (!/^\d{3,4}$/.test(cardForm.cvc)) { setCardError('Enter a valid CVC'); return null; }
        setCardError('');
        return { method, card: { cardNumber: digits, expMonth: month, expYear: year, cvc: cardForm.cvc } };
      }
      if (method === 'gcash') {
        const digits = gcashNumber.replace(/\s/g, '');
        if (!/^09\d{9}$/.test(digits)) {
          setGcashError('Enter a valid GCash number (e.g. 09171234567).');
          return null;
        }
        setGcashError('');
        return { method, gcashNumber: digits };
      }
      return { method };
    },
  }), [method, cardForm, gcashNumber]);

  return (
    <div>
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
        <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{stepNumber}</span>
        Payment Method
      </h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {PAYMENT_METHODS.map(m => (
          <label key={m.value} className={`flex flex-col items-center text-center gap-1.5 p-4 rounded-xl border cursor-pointer transition ${method === m.value ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="radio" name="payment" className="sr-only" checked={method === m.value} onChange={() => setMethod(m.value)} />
            <m.icon className={`w-6 h-6 mb-1 ${method === m.value ? 'text-brand-orange' : 'text-gray-400'}`} />
            <span className="text-sm font-semibold text-brand-ink">{m.label}</span>
            <span className="text-xs text-gray-400">{m.description}</span>
          </label>
        ))}
      </div>

      {method === 'card' && (
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Card Number</label>
            <input value={cardForm.cardNumber} onChange={e => setCardForm({ ...cardForm, cardNumber: e.target.value })} placeholder="1234 5678 9012 3456" className="input-field" inputMode="numeric" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Month</label>
              <Select value={cardForm.expMonth} onChange={expMonth => setCardForm({ ...cardForm, expMonth })} placeholder="MM" options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">Year</label>
              <Select value={cardForm.expYear} onChange={expYear => setCardForm({ ...cardForm, expYear })} placeholder="YYYY" options={cardYearOptions.map(y => ({ value: String(y), label: String(y) }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">CVC</label>
              <input value={cardForm.cvc} onChange={e => setCardForm({ ...cardForm, cvc: e.target.value.replace(/\D/g, '') })} placeholder="123" maxLength={4} className="input-field" inputMode="numeric" />
            </div>
          </div>
          {cardError && <p className="text-red-600 text-sm">{cardError}</p>}
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" /> Your card details go directly and securely to PayMongo, our payment processor — HomeLink never sees or stores your card number or CVC.
          </p>
        </div>
      )}

      {method === 'gcash' && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <label className="block text-sm font-medium mb-1.5 text-gray-700">GCash Mobile Number</label>
          <input
            value={gcashNumber}
            onChange={e => { setGcashNumber(e.target.value); setGcashError(''); }}
            placeholder="09171234567"
            inputMode="numeric"
            className="input-field max-w-xs"
          />
          {gcashError && <p className="text-red-600 text-sm mt-1.5">{gcashError}</p>}
          <p className="text-xs text-gray-400 mt-2">You'll be redirected to GCash to authorize this payment.</p>
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
