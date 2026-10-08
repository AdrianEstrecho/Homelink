import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Copy, Check, Banknote, Wallet, CreditCard, Plus, Loader2 } from 'lucide-react';
import Select from './Select';
import { api } from '../api/client';
import { PAYMENT_METHODS } from '../constants/paymentMethods';

const BANK_DETAILS = { bank: 'BDO Unibank', accountName: 'HomeLink Home Improvement Inc.', accountNumber: '0012 3456 7890' };

const sanitizeGcashNumber = (raw) => {
  let digits = raw.replace(/\D/g, '').slice(0, 11);
  while (digits && !'09'.startsWith(digits) && !digits.startsWith('09')) {
    digits = digits.slice(0, -1);
  }
  return digits;
};

const emptyCardForm = { cardNumber: '', expMonth: '', expYear: '', cvc: '' };
const cardYearOptions = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i);

// "4242424242424242" → "4242 4242 4242 4242" as it's typed.
const formatCardNumber = (raw) => raw.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

// A card stays valid through the last day of its expiry month.
const isExpired = (month, year) => {
  const now = new Date();
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
};

function RadioDot({ selected }) {
  return (
    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${selected ? 'border-brand-orange' : 'border-gray-300'}`}>
      {selected && <span className="w-2 h-2 rounded-full bg-brand-orange" />}
    </span>
  );
}

// Cash on delivery is only offered where there's a delivery to pay for, so it's opt-in per
// page rather than part of the default list (the service booking form shares this picker).
//
// Gateway methods (card, GCash, QR Ph) can each be switched off in admin Platform Settings.
// Until that list loads — or if it fails to — all of them show; the backend rejects a disabled
// one at /checkout-session either way.
const PaymentMethodPicker = forwardRef(function PaymentMethodPicker({ stepNumber = 2, allowCashOnDelivery = false }, ref) {
  const [enabledGateway, setEnabledGateway] = useState(null);
  useEffect(() => {
    api.get('/payments/methods').then(r => setEnabledGateway(r.gateway)).catch(() => {});
  }, []);

  const methods = PAYMENT_METHODS.filter(m =>
    (allowCashOnDelivery || !m.deliveryOnly) && (!m.gateway || !enabledGateway || enabledGateway.includes(m.value))
  );
  // Bank transfer has no toggle, so `methods` is never empty — if the picked method gets
  // switched off (card is the default), fall back to whatever is listed first.
  const [chosen, setChosen] = useState('card');
  const method = methods.some(m => m.value === chosen) ? chosen : methods[0].value;

  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [cardError, setCardError] = useState('');

  // The same cards as the account's Payment tab. null until loaded; a failed load just means
  // there's nothing to pick from, so the new-card form shows as it would for a first purchase.
  const [savedCards, setSavedCards] = useState(null);
  const [cardChoice, setCardChoice] = useState(null); // saved card id | 'new' | null (= default)
  const [saveNewCard, setSaveNewCard] = useState(true);
  useEffect(() => {
    api.get('/payment-methods/my').then(setSavedCards).catch(() => setSavedCards([]));
  }, []);

  const usableCards = (savedCards || []).filter(c => !isExpired(Number(c.exp_month), Number(c.exp_year)));
  const defaultCardId = (usableCards.find(c => c.is_default) || usableCards[0])?.id || 'new';
  const selectedCard = cardChoice === 'new' || usableCards.some(c => c.id === cardChoice) ? cardChoice : defaultCardId;

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

  // Card number/CVC and the GCash number are collected here for a complete-feeling checkout
  // page, but PayMongo's hosted page is what actually collects payment credentials — these
  // values are validated for shape only and never sent to the payment flow (see
  // handleConfirmOrder / startBookingPayment, which only forward `method`). Ticking "save this
  // card" stores just its brand, last 4 and expiry, the same as adding one from the account's
  // Payment tab, so it shows up as a saved card next time.
  useImperativeHandle(ref, () => ({
    validate: () => {
      if (method === 'card') {
        if (savedCards === null) { setCardError('Still loading your saved cards — try again in a moment.'); return null; }
        if (selectedCard !== 'new') { setCardError(''); return { method }; }

        const digits = cardForm.cardNumber.replace(/\D/g, '');
        if (digits.length < 12 || digits.length > 19) { setCardError('Enter a valid card number'); return null; }
        const month = Number(cardForm.expMonth), year = Number(cardForm.expYear);
        if (!month || month < 1 || month > 12 || !year) { setCardError('Enter a valid expiry date'); return null; }
        if (isExpired(month, year)) { setCardError('This card has expired'); return null; }
        if (!/^\d{3,4}$/.test(cardForm.cvc)) { setCardError('Enter a valid CVC'); return null; }
        setCardError('');

        const alreadySaved = savedCards.some(c => c.last4 === digits.slice(-4) && Number(c.exp_month) === month && Number(c.exp_year) === year);
        if (saveNewCard && !alreadySaved) {
          // Fire-and-forget: a card that fails to save shouldn't hold up the order itself.
          api.post('/payment-methods', { cardNumber: digits, expMonth: month, expYear: year }).catch(() => {});
        }
        return { method };
      }
      if (method === 'gcash') {
        const digits = gcashNumber.replace(/\s/g, '');
        if (!/^09\d{9}$/.test(digits)) {
          setGcashError('Enter a valid GCash number (e.g. 09171234567).');
          return null;
        }
        setGcashError('');
        return { method };
      }
      return { method };
    },
  }), [method, cardForm, gcashNumber, savedCards, selectedCard, saveNewCard]);

  return (
    <div>
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-brand-ink mb-5">
        <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{stepNumber}</span>
        Payment Method
      </h2>
      <div className={`grid sm:grid-cols-2 gap-3 ${methods.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {methods.map(m => (
          <label key={m.value} className={`flex flex-col items-center text-center gap-1.5 p-4 rounded-xl border cursor-pointer transition ${method === m.value ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 hover:border-gray-300'}`}>
            <input type="radio" name="payment" className="sr-only" checked={method === m.value} onChange={() => setChosen(m.value)} />
            <m.icon className={`w-6 h-6 mb-1 ${method === m.value ? 'text-brand-orange' : 'text-gray-400'}`} />
            <span className="text-sm font-semibold text-brand-ink">{m.label}</span>
            <span className="text-xs text-gray-400">{m.description}</span>
          </label>
        ))}
      </div>

      {method === 'card' && (
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
          {savedCards === null ? (
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your saved cards…
            </p>
          ) : (
            <>
              {savedCards.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-sm font-medium text-gray-700">Your cards</p>
                    <Link to="/account?tab=payment" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition">Manage cards</Link>
                  </div>
                  <div role="radiogroup" aria-label="Choose a card" className="space-y-2.5">
                    {savedCards.map(c => {
                      const expired = isExpired(Number(c.exp_month), Number(c.exp_year));
                      const selected = selectedCard === c.id;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-orange ${
                            expired ? 'border-gray-200 opacity-60 cursor-not-allowed'
                              : selected ? 'border-brand-orange bg-brand-orange/5 cursor-pointer'
                                : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                          }`}
                        >
                          <input type="radio" name="saved-card" className="sr-only" checked={selected} disabled={expired} onChange={() => { setCardChoice(c.id); setCardError(''); }} />
                          <RadioDot selected={selected} />
                          <span className="w-10 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4 text-brand-navy" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-brand-ink">{c.brand} •••• {c.last4}</span>
                            <span className={`block text-xs ${expired ? 'text-red-600' : 'text-gray-500'}`}>
                              {expired ? 'Expired' : 'Expires'} {String(c.exp_month).padStart(2, '0')}/{c.exp_year}
                            </span>
                          </span>
                          {!!c.is_default && <span className="badge bg-brand-teal/15 text-brand-teal shrink-0">Default</span>}
                        </label>
                      );
                    })}
                    <label
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-orange ${
                        selectedCard === 'new' ? 'border-brand-orange bg-brand-orange/5' : 'border-dashed border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input type="radio" name="saved-card" className="sr-only" checked={selectedCard === 'new'} onChange={() => { setCardChoice('new'); setCardError(''); }} />
                      <RadioDot selected={selectedCard === 'new'} />
                      <span className="w-10 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 text-brand-orange" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-brand-ink">Add a new card</span>
                        <span className="block text-xs text-gray-500">Visa, Mastercard, Amex & more</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {selectedCard === 'new' && (
                <div className={`space-y-4 ${savedCards.length > 0 ? 'p-4 rounded-xl bg-gray-50 border border-gray-100' : ''}`}>
                  <div>
                    <label htmlFor="card-number" className="block text-sm font-medium mb-1.5 text-gray-700">Card Number</label>
                    <input id="card-number" value={cardForm.cardNumber} onChange={e => { setCardForm({ ...cardForm, cardNumber: formatCardNumber(e.target.value) }); setCardError(''); }} placeholder="1234 5678 9012 3456" className="input-field tabular-nums" inputMode="numeric" autoComplete="cc-number" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-gray-700">Month</label>
                      <Select value={cardForm.expMonth} onChange={expMonth => { setCardForm({ ...cardForm, expMonth }); setCardError(''); }} placeholder="MM" options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1).padStart(2, '0') }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 text-gray-700">Year</label>
                      <Select value={cardForm.expYear} onChange={expYear => { setCardForm({ ...cardForm, expYear }); setCardError(''); }} placeholder="YYYY" options={cardYearOptions.map(y => ({ value: String(y), label: String(y) }))} />
                    </div>
                    <div>
                      <label htmlFor="card-cvc" className="block text-sm font-medium mb-1.5 text-gray-700">CVC</label>
                      <input id="card-cvc" value={cardForm.cvc} onChange={e => { setCardForm({ ...cardForm, cvc: e.target.value.replace(/\D/g, '') }); setCardError(''); }} placeholder="123" maxLength={4} className="input-field" inputMode="numeric" autoComplete="cc-csc" />
                    </div>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={saveNewCard} onChange={e => setSaveNewCard(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-brand-orange shrink-0" />
                    <span className="text-sm text-gray-700">
                      Save this card for next time
                      <span className="block text-xs text-gray-400 mt-0.5">Only the card brand, last 4 digits and expiry are kept — never the full number or CVC.</span>
                    </span>
                  </label>
                </div>
              )}
            </>
          )}
          {cardError && <p className="text-red-600 text-sm">{cardError}</p>}
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" /> You'll confirm this on a secure PayMongo page next — HomeLink never sees or stores your card number or CVC.
          </p>
        </div>
      )}

      {method === 'gcash' && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <label className="block text-sm font-medium mb-1.5 text-gray-700">GCash Mobile Number</label>
          <input
            value={gcashNumber}
            onChange={e => { setGcashNumber(sanitizeGcashNumber(e.target.value)); setGcashError(''); }}
            placeholder="09171234567"
            inputMode="numeric"
            maxLength={11}
            className="input-field max-w-xs"
          />
          {gcashError && <p className="text-red-600 text-sm mt-1.5">{gcashError}</p>}
          <p className="text-xs text-gray-400 mt-2">You'll be taken to a secure PayMongo page to log in and authorize this payment.</p>
        </div>
      )}

      {method === 'qrph' && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-sm text-gray-500">You'll be taken to a secure PayMongo page to scan a QR code with GCash, Maya, or your bank's app.</p>
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

      {method === 'cod' && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
            <p className="flex items-start gap-2 text-sm text-brand-ink">
              <Banknote className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
              <span>Pay the courier in cash when your order arrives. Nothing is charged now.</span>
            </p>
            <p className="flex items-start gap-2 text-sm text-gray-500">
              <Wallet className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span>Please prepare the exact amount — our riders may not carry change.</span>
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-2">Someone aged 18 or over needs to be at the address to receive the order and pay.</p>
        </div>
      )}
    </div>
  );
});

export default PaymentMethodPicker;
