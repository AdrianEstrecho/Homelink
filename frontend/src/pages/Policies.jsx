import { Shield, RefreshCw, Headphones, XCircle, Lock } from 'lucide-react';

const policies = [
  { icon: RefreshCw, title: 'Refund Policy', content: 'Customers are eligible for a refund if purchased products or services are not received or fulfilled. Refund requests must be submitted within 7 days of the expected delivery or service date. Refunds are processed within 5-10 business days to the original payment method.' },
  { icon: Headphones, title: 'Service Support', content: 'Customers may report service-related issues to our support team for resolution. Contact us at support@homelink.com or call (02) 8123-4567. Our team responds within 24 hours on business days.' },
  { icon: Lock, title: 'Data Privacy', content: 'All customer information, including personal contact details and payment data, is handled with strict confidentiality and protected by our security protocols. We comply with the Data Privacy Act and never share your data with third parties without consent.' },
  { icon: XCircle, title: 'Cancellation Policy', content: 'Customers may request to cancel orders for products or services, provided the request is submitted within the designated timeframe and meets our cancellation criteria. Product orders can be cancelled before shipping. Service bookings can be cancelled up to 24 hours before the scheduled appointment.' },
];

export default function Policies() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-16">
        <p className="eyebrow justify-center mb-4"><Shield className="w-3.5 h-3.5" /> Trust &amp; Safety</p>
        <h1 className="section-title">Policies</h1>
        <p className="text-gray-500 mt-3">Your trust and satisfaction are our priority.</p>
      </div>
      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {policies.map(p => (
          <div key={p.title} className="py-8 flex gap-5">
            <p.icon className="w-5 h-5 text-brand-navy shrink-0 mt-1" />
            <div>
              <h2 className="font-display font-bold text-lg text-brand-ink mb-2">{p.title}</h2>
              <p className="text-gray-500 leading-relaxed">{p.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
