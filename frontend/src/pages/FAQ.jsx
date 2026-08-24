import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

const FAQS = [
  { q: 'How do I order a product?', a: 'Browse our catalog, add items to your cart, and check out with your preferred payment method. You can track your order status anytime from your account.' },
  { q: 'How does service booking work?', a: 'Pick a service, choose an available date and time, and confirm your booking. A verified technician will be assigned and you can track the job status right up to completion.' },
  { q: 'Are your technicians verified?', a: 'Yes. Every technician on HomeLink is background-checked and trained before they\'re allowed to take on jobs, so you can trust who shows up at your door.' },
  { q: 'What payment methods do you accept?', a: 'We accept major credit/debit cards, GCash, and other popular online payment methods through our secure checkout.' },
  { q: 'Can I cancel or reschedule a booking?', a: 'Yes, service bookings can be cancelled or rescheduled up to 24 hours before the scheduled appointment. Product orders can be cancelled before they ship.' },
  { q: 'What is your refund policy?', a: 'If a product or service isn\'t received or fulfilled, you\'re eligible for a refund. Requests must be submitted within 7 days of the expected delivery or service date, and are processed within 5-10 business days.' },
  { q: 'Do installed products come with a warranty?', a: 'Most products carry a manufacturer warranty, and installation work is backed by our service guarantee. Warranty details are listed on each product and service page.' },
  { q: 'How do I get help if something goes wrong?', a: 'Reach our support team at support@homelink.com or (02) 8123-4567. We respond within 24 hours on business days.' },
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-16">
        <p className="eyebrow justify-center mb-4"><HelpCircle className="w-3.5 h-3.5" /> Support</p>
        <h1 className="section-title">Frequently Asked Questions</h1>
        <p className="text-gray-500 mt-3">Answers to the questions we hear most from homeowners.</p>
      </div>
      <div className="divide-y divide-gray-100 border-t border-b border-gray-100">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 py-6 text-left"
              >
                <span className="font-display font-bold text-brand-ink">{item.q}</span>
                <ChevronDown className={`w-4.5 h-4.5 text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-orange' : ''}`} />
              </button>
              <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                <div className="overflow-hidden">
                  <p className="text-gray-500 leading-relaxed pb-6 pr-8">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
