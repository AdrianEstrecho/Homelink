import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, X, Megaphone, Image as ImageIcon, HelpCircle, Shield, FileText, UploadCloud, Save } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import ConfirmDialog from '../../components/ConfirmDialog';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 5;

const TABS = [
  { key: 'banners', label: 'Banners', icon: Megaphone },
  { key: 'gallery', label: 'Gallery', icon: ImageIcon },
  { key: 'faqs', label: 'FAQs', icon: HelpCircle },
  { key: 'policies', label: 'Policies', icon: Shield },
  { key: 'pageText', label: 'Page Text', icon: FileText },
];

const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'info', label: 'Info' },
  { value: 'promo', label: 'Promo' },
  { value: 'warning', label: 'Warning' },
];

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Banners ----------
const emptyAnnouncement = { title: '', content: '', type: 'info' };

function BannersTab({ onRequestDelete }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyAnnouncement);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/announcements').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const cancelForm = () => { setShowForm(false); setForm(emptyAnnouncement); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/announcements', form);
      cancelForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (id) => { await api.put(`/admin/announcements/${id}/toggle`); load(); };

  return (
    <div>
      <SectionHeader
        title="Homepage Banners"
        subtitle="Shown in the scrolling strip near the top of the homepage."
        action={!showForm && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Banner</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <input placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" />
          <textarea placeholder="Content" required rows={2} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input-field" />
          <Select value={form.type} onChange={v => setForm({ ...form, type: v })} options={ANNOUNCEMENT_TYPE_OPTIONS} className="max-w-xs" />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary text-sm">Save Banner</button>
            <button type="button" onClick={cancelForm} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">No banners yet.</td></tr>
            ) : items.map(a => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{a.title}</p>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{a.content}</p>
                </td>
                <td className="p-3"><span className="badge bg-gray-100 text-gray-600 capitalize">{a.type}</span></td>
                <td className="p-3">
                  <button onClick={() => toggle(a.id)} className={`badge ${a.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {a.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => onRequestDelete({ label: a.title, onConfirm: async () => { await api.delete(`/admin/announcements/${a.id}`); load(); } })} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Gallery ----------
const emptyGallery = { title: '', image: '', category: '', sortOrder: 0 };

function GalleryTab({ onRequestDelete }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyGallery);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => api.get('/admin/gallery').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyGallery); setError(''); setDragActive(false); };
  const startEdit = (g) => { setEditingId(g.id); setForm({ title: g.title || '', image: g.image, category: g.category || '', sortOrder: g.sort_order || 0 }); setShowForm(true); };

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { setError('Please upload a JPG, PNG, WebP, or GIF image.'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`Image must be smaller than ${MAX_IMAGE_MB}MB.`); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result }));
    reader.readAsDataURL(file);
  };
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.image) { setError('Please add an image.'); return; }
    try {
      if (editingId) await api.put(`/admin/gallery/${editingId}`, form);
      else await api.post('/admin/gallery', form);
      cancelForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <SectionHeader
        title="About Page Gallery"
        subtitle="Photos shown in the gallery grid on the About page."
        action={!showForm && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Photo</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-4 space-y-3 max-w-lg">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {form.image ? (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              <img src={form.image} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))} className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-gray-600 hover:bg-white shadow"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition ${dragActive ? 'border-brand-orange bg-orange-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
            >
              <UploadCloud className="w-8 h-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">Click or drag &amp; drop to upload</p>
              <p className="text-xs text-gray-400">Accepted: JPG, PNG, WebP, GIF (Max 5MB)</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          <input placeholder="Title (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" />
          <input placeholder="Category (optional)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" />
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary text-sm">{editingId ? 'Save Changes' : 'Add Photo'}</button>
            <button type="button" onClick={cancelForm} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.length === 0 ? (
          <p className="col-span-full text-sm text-gray-400 text-center py-8">No gallery photos yet.</p>
        ) : items.map(g => (
          <div key={g.id} className="card overflow-hidden group relative">
            <img src={g.image} alt={g.title || ''} className="w-full h-32 object-cover" />
            <div className="p-2.5">
              <p className="text-sm font-medium text-gray-800 truncate">{g.title || 'Untitled'}</p>
              {g.category && <p className="text-xs text-gray-400 truncate">{g.category}</p>}
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => startEdit(g)} className="p-1.5 rounded-lg bg-white/90 text-[#00806f] hover:bg-white shadow"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onRequestDelete({ label: g.title || 'this photo', onConfirm: async () => { await api.delete(`/admin/gallery/${g.id}`); load(); } })} className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white shadow"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- FAQs ----------
const emptyFaq = { question: '', answer: '', sortOrder: 0 };

function FaqsTab({ onRequestDelete }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyFaq);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/faqs').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyFaq); setError(''); };
  const startEdit = (f) => { setEditingId(f.id); setForm({ question: f.question, answer: f.answer, sortOrder: f.sort_order }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/faqs/${editingId}`, form);
      else await api.post('/admin/faqs', form);
      cancelForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (f) => { await api.put(`/admin/faqs/${f.id}`, { active: !f.active }); load(); };

  return (
    <div>
      <SectionHeader
        title="Frequently Asked Questions"
        subtitle="Shown on the public FAQ page, in order."
        action={!showForm && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add FAQ</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <input placeholder="Question" required value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} className="input-field" />
          <textarea placeholder="Answer" required rows={3} value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} className="input-field" />
          <label className="block max-w-[140px]">
            <span className="text-xs font-medium text-gray-500 mb-1 block">Sort Order</span>
            <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} className="input-field" />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary text-sm">{editingId ? 'Save Changes' : 'Add FAQ'}</button>
            <button type="button" onClick={cancelForm} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No FAQs yet.</p>
        ) : items.map(f => (
          <div key={f.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-800">{f.question}</p>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{f.answer}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => toggle(f)} className={`badge ${f.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{f.active ? 'Active' : 'Hidden'}</button>
              <button onClick={() => startEdit(f)} className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onRequestDelete({ label: f.question, onConfirm: async () => { await api.delete(`/admin/faqs/${f.id}`); load(); } })} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Policies ----------
const emptyPolicy = { title: '', content: '', sortOrder: 0 };

function PoliciesTab({ onRequestDelete }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyPolicy);
  const [error, setError] = useState('');

  const load = () => api.get('/admin/policies').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyPolicy); setError(''); };
  const startEdit = (p) => { setEditingId(p.id); setForm({ title: p.title, content: p.content, sortOrder: p.sort_order }); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/policies/${editingId}`, form);
      else await api.post('/admin/policies', form);
      cancelForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (p) => { await api.put(`/admin/policies/${p.id}`, { active: !p.active }); load(); };

  return (
    <div>
      <SectionHeader
        title="Policies"
        subtitle="Shown on the public Policies page, in order."
        action={!showForm && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Policy</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <input placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" />
          <textarea placeholder="Content" required rows={3} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input-field" />
          <label className="block max-w-[140px]">
            <span className="text-xs font-medium text-gray-500 mb-1 block">Sort Order</span>
            <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} className="input-field" />
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" className="btn-primary text-sm">{editingId ? 'Save Changes' : 'Add Policy'}</button>
            <button type="button" onClick={cancelForm} className="text-sm text-gray-500 hover:text-gray-700 px-3">Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No policies yet.</p>
        ) : items.map(p => (
          <div key={p.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-800">{p.title}</p>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{p.content}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => toggle(p)} className={`badge ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{p.active ? 'Active' : 'Hidden'}</button>
              <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => onRequestDelete({ label: p.title, onConfirm: async () => { await api.delete(`/admin/policies/${p.id}`); load(); } })} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Page Text ----------
const PAGE_TEXT_FIELDS = [
  { key: 'about_heading', label: 'About Page Heading' },
  { key: 'about_intro', label: 'About Page Intro', multiline: true },
  { key: 'contact_address', label: 'Contact Address', multiline: true },
  { key: 'contact_phone', label: 'Contact Phone' },
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'contact_lat', label: 'Contact Latitude' },
  { key: 'contact_lng', label: 'Contact Longitude' },
];

function PageTextTab() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { api.get('/admin/settings').then(setForm).catch(() => {}); }, []);

  if (!form) return <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    const payload = Object.fromEntries(PAGE_TEXT_FIELDS.map(f => [f.key, form[f.key]]));
    await api.put('/admin/settings', payload);
    setSaving(false);
    setNotice('Saved.');
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-4">
      <SectionHeader title="Page Text" subtitle="Editable copy used on the About and Contact (Location) pages." />
      {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      <div className="card p-5 space-y-4">
        {PAGE_TEXT_FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</span>
            {f.multiline ? (
              <textarea rows={3} value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} className="input-field" />
            ) : (
              <input value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} className="input-field" />
            )}
          </label>
        ))}
      </div>
      <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}

// ---------- Page ----------
export default function AdminCMS() {
  const [tab, setTab] = useState('banners');
  const [pendingDelete, setPendingDelete] = useState(null);

  const requestDelete = (payload) => setPendingDelete(payload);
  const confirmDelete = async () => {
    await pendingDelete.onConfirm();
    setPendingDelete(null);
  };

  return (
    <AdminLayout title="Content (CMS)" subtitle="Manage banners, gallery photos, FAQs, policies, and other public-facing content.">
      <ConfirmDialog
        open={!!pendingDelete}
        icon={Trash2}
        tone="delete"
        title="Delete this item?"
        message={pendingDelete ? `"${pendingDelete.label}" will be removed. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === t.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'banners' && <BannersTab onRequestDelete={requestDelete} />}
      {tab === 'gallery' && <GalleryTab onRequestDelete={requestDelete} />}
      {tab === 'faqs' && <FaqsTab onRequestDelete={requestDelete} />}
      {tab === 'policies' && <PoliciesTab onRequestDelete={requestDelete} />}
      {tab === 'pageText' && <PageTextTab />}
    </AdminLayout>
  );
}
