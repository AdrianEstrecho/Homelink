import { FileText } from 'lucide-react';
import { termsSections as sections } from '../data/termsContent';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-14 md:py-16">
      <div className="text-center mb-14">
        <p className="eyebrow justify-center mb-4"><FileText className="w-3.5 h-3.5" /> Legal</p>
        <h1 className="section-title">Terms &amp; Conditions</h1>
        <p className="text-gray-500 mt-3">Please read these terms carefully before using HomeLink.</p>
      </div>
      <div className="space-y-5">
        {sections.map(s => (
          <div key={s.title} className="card p-6">
            <h2 className="font-display font-bold text-lg text-brand-ink mb-2">{s.title}</h2>
            <p className="text-gray-500 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
