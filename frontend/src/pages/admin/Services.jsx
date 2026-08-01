import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Search, X, ImageOff, UploadCloud } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import PromptDialog from '../../components/PromptDialog';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 5;

const emptyForm = {
  name: '', category: '', description: '',
  status: 'active',
  basePrice: '', discount: '', durationHours: '2',
  image: '',
};

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function AdminServices() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState(searchParams.get('tab') === 'archived' ? 'archived' : 'active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dragActive, setDragActive] = useState(false);
  const [categoryPromptOpen, setCategoryPromptOpen] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    api.get('/admin/services').then(setServices).catch(() => {});
    api.get('/services/categories').then(setCategories).catch(() => {});
  };
  useEffect(load, []);

  const byTabAndSearch = useMemo(() => {
    return services
      .filter(s => (tab === 'archived' ? s.archived : !s.archived))
      .filter(s => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [services, tab, search]);

  const categoryCounts = useMemo(() => {
    const c = { '': byTabAndSearch.length };
    categories.forEach(cat => { c[cat] = byTabAndSearch.filter(s => s.category === cat).length; });
    return c;
  }, [byTabAndSearch, categories]);

  const filtered = categoryFilter ? byTabAndSearch.filter(s => s.category === categoryFilter) : byTabAndSearch;

  const activeCount = services.filter(s => !s.archived).length;
  const archivedCount = services.filter(s => s.archived).length;

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const startEdit = (s) => {
    setForm({
      name: s.name, category: s.category, description: s.description || '',
      status: s.status === 'inactive' ? 'inactive' : 'active',
      basePrice: s.base_price, discount: s.discount || 0, durationHours: s.duration_hours,
      image: s.image || '',
    });
    setEditingId(s.id);
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setDragActive(false); };

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result }));
    reader.readAsDataURL(file);
  };
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); };

  const handleCategoryChange = (value) => {
    if (value !== '__new__') { setForm(f => ({ ...f, category: value })); return; }
    setCategoryPromptOpen(true);
  };

  const confirmNewCategory = (label) => {
    setCategories(prev => prev.includes(label) ? prev : [...prev, label].sort());
    setForm(f => ({ ...f, category: label }));
    setCategoryPromptOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name, category: form.category, description: form.description,
      basePrice: Number(form.basePrice), discount: Number(form.discount) || 0,
      durationHours: Number(form.durationHours), image: form.image, status: form.status,
    };
    if (editingId) await api.put(`/admin/services/${editingId}`, payload);
    else await api.post('/admin/services', { ...payload, slug: slugify(form.name) });
    cancelForm();
    load();
  };

  const archive = async (id) => { await api.put(`/admin/services/${id}/archive`); load(); };
  const restore = async (id) => { await api.put(`/admin/services/${id}/restore`); load(); };
  const remove = async (id) => {
    if (!confirm('Permanently delete this service? This cannot be undone.')) return;
    await api.delete(`/admin/services/${id}`);
    load();
  };

  return (
    <AdminLayout title="Services" subtitle="View and manage your service offerings.">
      <PromptDialog
        open={categoryPromptOpen}
        title="New Category"
        message="Enter a name for the new service category."
        placeholder="e.g. Deep Cleaning"
        onConfirm={confirmNewCategory}
        onCancel={() => setCategoryPromptOpen(false)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TabButton active={tab === 'active'} onClick={() => setTab('active')}>All Active ({activeCount})</TabButton>
          <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>Archived ({archivedCount})</TabButton>
        </div>
        {!showForm && (
          <button onClick={startAdd} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Service</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-lg">{editingId ? 'Edit Service' : 'Add New Service'}</h3>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="md:col-span-2">
              <Field label="Service Name" required>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Description" required>
                <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
              </Field>
            </div>

            <Field label="Category" required>
              <Select
                value={form.category}
                onChange={handleCategoryChange}
                placeholder="Select Category"
                options={[
                  ...categories.map(cat => ({ value: cat, label: cat })),
                  { value: '__new__', label: '+ Add new category...' },
                ]}
              />
            </Field>
            <Field label="Status" required>
              <Select
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </Field>

            <Field label="Base Price (₱)" required>
              <input type="number" min="0" step="0.01" required value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} className="input-field" />
            </Field>
            <Field label="Discount (%)">
              <input type="number" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="input-field" />
            </Field>

            <Field label="Duration (hours)" required>
              <input type="number" min="0" step="0.5" required value={form.durationHours} onChange={e => setForm(f => ({ ...f, durationHours: e.target.value }))} className="input-field" />
            </Field>
            <div />

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Cover Image</label>
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
            </div>

            <button type="submit" className="btn-primary md:col-span-2">{editingId ? 'Save Changes' : 'Save Service'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-visible p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="w-56"
          options={[
            { value: '', label: `All Categories (${categoryCounts[''] || 0})` },
            ...categories.map(cat => ({ value: cat, label: `${cat} (${categoryCounts[cat] || 0})` })),
          ]}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Service</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No services {tab === 'archived' ? 'archived' : 'found'}.</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {s.image ? (
                      <img src={s.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100" onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-gray-300" /></div>
                    )}
                    <span className="font-medium text-gray-800">{s.name}</span>
                  </div>
                </td>
                <td className="p-3 text-gray-600">{s.category}</td>
                <td className="p-3 text-gray-600">
                  {formatPrice(s.base_price)}
                  {s.discount > 0 && <span className="ml-1.5 badge bg-orange-100 text-brand-orange">-{s.discount}%</span>}
                </td>
                <td className="p-3 text-gray-600">~{Number(s.duration_hours).toFixed(1)}h</td>
                <td className="p-3">
                  <span className={`badge ${s.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                    {s.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(s)} title="Edit" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition"><Pencil className="w-3.5 h-3.5" /></button>
                    {s.archived ? (
                      <button onClick={() => restore(s.id)} title="Restore" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <button onClick={() => archive(s.id)} title="Archive" className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => remove(s.id)} title="Delete permanently" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
