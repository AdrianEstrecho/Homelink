import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { CreditCard, Smartphone, Landmark, Plus, Check, ShieldCheck, Copy } from 'lucide-react';
import { api } from '../api/client';
import Select from './Select';

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard & more', icon: CreditCard },
  { value: 'gcash', label: 'GCash', description: 'Pay with your wallet', icon: Smartphone },
  { value: 'bank', label: 'Bank Transfer', description: 'Direct bank deposit', icon: Landmark },
];

const BANK_DETAILS = { bank: 'BDO Unibank', accountName: 'HomeLink Home Improvement Inc.', accountNumber: '0012 3456 7890' };

const emptyCardForm = { cardNumber: '', expMonth: '', expYear: '' };
const cardYearOptions = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

const PaymentMethodPicker = forwardRef(function PaymentMethodPicker({ stepNumber = 2 }, ref) {
  const [method, setMethod] = useState('card');

  const [savedCards, setSavedCards] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState('');

  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashError, setGcashError] = useState('');

  const [bankCopied, setBankCopied] = useState(false);

  useEffect(() => {
    api.get('/payment-methods/my').then(data => {
      setSavedCards(data);
      const def = data.find(c => c.is_default) || data[0];
      if (def) setSelectedCardId(def.id); else setShowCardForm(true);
    }).catch(() => { setSavedCards([]); setShowCardForm(true); });
  }, []);

  const handleSaveCard = async () => {
    setSavingCard(true);
    setCardError('');
    try {
      const saved = await api.post('/payment-methods', cardForm);
      setSavedCards(prev => [saved, ...(prev || [])]);
      setSelectedCardId(saved.id);
      setShowCardForm(false);
      setCardForm(emptyCardForm);
    } catch (err) {
      setCardError(err.message);
    } finally {
      setSavingCard(false);
    }
  };

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
        if (!savedCards?.find(c => c.id === selectedCardId)) { setCardError('Please select or add a card.'); return null; }
      }
      if (method === 'gcash') {
        if (!/^09\d{9}$/.test(gcashNumber.replace(/\s/g, ''))) {
          setGcashError('Enter a valid GCash number (e.g. 09171234567).');
          return null;
        }
      }
      return { method, cardId: method === 'card' ? selectedCardId : null, gcashNumber: method === 'gcash' ? gcashNumber : null };
    },
  }), [method, savedCards, selectedCardId, gcashNumber]);

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
        <div className="mt-5 pt-5 border-t border-gray-100">
          {savedCards === null ? (
            <p className="text-sm text-gray-400">Loading cards...</p>
          ) : savedCards.length > 0 ? (
            <div className="space-y-2.5 mb-4">
              {savedCards.map(c => (
                <label key={c.id} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition ${selectedCardId === c.id ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="card" checked={selectedCardId === c.id} onChange={() => setSelectedCardId(c.id)} className="accent-brand-orange" />
                  <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-brand-ink flex-1">{c.brand} •••• {c.last4}</span>
                  <span className="text-xs text-gray-400">Exp {String(c.exp_month).padStart(2, '0')}/{c.exp_year}</span>
                  {!!c.is_default && <span className="badge bg-brand-teal/15 text-brand-teal">Default</span>}
                </label>
              ))}
            </div>
          ) : null}

          {showCardForm ? (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">Card Number</label>
                <input value={cardForm.cardNumber} onChange={e => setCardForm({ ...cardForm, cardNumber: e.target.value })} placeholder="1234 5678 9012 3456" className="input-field" inputMode="numeric" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">Expiry Month</label>
                  <Select value={cardForm.expMonth} onChange={expMonth => setCardForm({ ...cardForm, expMonth })} placeholder="Month" options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">Expiry Year</label>
                  <Select value={cardForm.expYear} onChange={expYear => setCardForm({ ...cardForm, expYear })} placeholder="Year" options={cardYearOptions.map(y => ({ value: String(y), label: String(y) }))} />
                </div>
              </div>
              {cardError && <p className="text-red-600 text-sm">{cardError}</p>}
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" /> We only store your card's brand and last 4 digits.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveCard} disabled={savingCard} className="btn-primary text-sm py-2 disabled:opacity-60">
                  {savingCard ? 'Saving...' : 'Save & Use This Card'}
                </button>
                {savedCards?.length > 0 && (
                  <button type="button" onClick={() => { setShowCardForm(false); setCardError(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setShowCardForm(true); setCardError(''); }} className="flex items-center gap-1 text-sm font-semibold text-brand-teal hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add New Card
            </button>
          )}
          {!showCardForm && cardError && <p className="text-red-600 text-sm mt-2">{cardError}</p>}
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
          <p className="text-xs text-gray-400 mt-2">We'll send a payment request to this number once confirmed.</p>
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
