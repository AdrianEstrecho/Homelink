import { useEffect, useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { api } from '../api/client';

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(0);

  useEffect(() => { api.get('/faqs').then(setFaqs).catch(() => {}); }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
      <div className="text-center mb-16">
        <p className="eyebrow justify-center mb-4"><HelpCircle className="w-3.5 h-3.5" /> Support</p>
        <h1 className="section-title">Frequently Asked Questions</h1>
        <p className="text-gray-500 mt-3">Answers to the questions we hear most from homeowners.</p>
      </div>
      <div className="divide-y divide-gray-100 border-t border-b border-gray-100">
        {faqs.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.id}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 py-6 text-left"
              >
                <span className="font-display font-bold text-brand-ink">{item.question}</span>
                <ChevronDown className={`w-4.5 h-4.5 text-gray-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-orange' : ''}`} />
              </button>
              <div className="grid transition-[grid-template-rows] duration-300 ease-in-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                <div className="overflow-hidden">
                  <p className="text-gray-500 leading-relaxed pb-6 pr-8">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
