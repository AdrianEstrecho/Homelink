import { useEffect, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { api } from '../../api/client';
import Select from '../Select';

const TYPE_OPTIONS = [
  { value: 'support', label: 'Support Inquiry' },
  { value: 'complaint', label: 'Complaint' },
];

const STATUS_STYLE = { open: 'bg-amber-100 text-amber-800', resolved: 'bg-green-100 text-green-800' };

export default function SupportTab() {
  const [messages, setMessages] = useState(null);
  const [type, setType] = useState('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/support/my').then(setMessages).catch(() => setMessages([]));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { setError('Please fill in both the subject and message.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/support', { type, subject, message });
      setSubject('');
      setMessage('');
      setType('support');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="font-display font-semibold text-lg text-brand-navy mb-1">Support &amp; Complaints</h2>
      <p className="text-sm text-gray-500 mb-6">Reach out to our team with a question, issue, or complaint — we'll get back to you.</p>

      <form onSubmit={submit} className="space-y-3 mb-8">
        <Select value={type} onChange={setType} options={TYPE_OPTIONS} className="max-w-xs" />
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
          className="input-field"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us what's going on..."
          rows={4}
          className="input-field"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-60">
          <Send className="w-4 h-4" /> {saving ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">My Messages</h3>
      {messages === null ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : messages.length === 0 ? (
        <div className="text-center py-10">
          <LifeBuoy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">You haven't sent any messages yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-800">{m.subject}</p>
                <span className={`badge capitalize ${STATUS_STYLE[m.status]}`}>{m.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{m.message}</p>
              <p className="text-xs text-gray-400 mt-2">{m.type === 'complaint' ? 'Complaint' : 'Support Inquiry'} · {new Date(m.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
