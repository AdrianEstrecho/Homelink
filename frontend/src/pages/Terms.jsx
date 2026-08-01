import { FileText } from 'lucide-react';
import { termsSections as sections } from '../data/termsContent';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <FileText className="w-12 h-12 text-brand-navy mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold text-brand-navy">Terms &amp; Conditions</h1>
        <p className="text-gray-600 mt-2">Please read these terms carefully before using HomeLink</p>
      </div>
      <div className="space-y-6">
        {sections.map(s => (
          <div key={s.title} className="card p-6">
            <h2 className="font-semibold text-lg mb-2">{s.title}</h2>
            <p className="text-gray-600 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
